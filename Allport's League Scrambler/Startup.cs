using dotenv.net;
using Allport_s_League_Scrambler.Pickup;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using System.IO;
using Allport_s_League_Scrambler.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SpaServices.AngularCli;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;
using System.Net.Mail;
using System.Text;

namespace Allport_s_League_Scrambler
{
    public class Startup
    {
        public Startup(IConfiguration configuration, IWebHostEnvironment environment)
        {
            var localSettings = System.IO.Path.Combine(environment.ContentRootPath, ".env");
            if (!PickupEnvironment.DisposableTest)
            {
                if (System.IO.File.Exists(localSettings))
                    DotEnv.Load(options: new DotEnvOptions(envFilePaths: new[] { localSettings }, overwriteExistingVars: false));
                else
                    DotEnv.Load(options: new DotEnvOptions(probeForEnv: true, probeLevelsToSearch: 6, overwriteExistingVars: false));
            }

            PickupEnvironment.Configure(environment);
            PickupEnvironment.ConfigureProduction(environment);
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc(options => options.SuppressAsyncSuffixInActionNames = false)
                .AddNewtonsoftJson();
            services.AddSpaStaticFiles(configuration =>
            {
                configuration.RootPath = "ClientApp/dist/browser";
            });

            // Configure authentication with cookie settings
            services.AddSingleton<AccountRoleLookup>(LeagueAccess.ReadAccountRole);
            var authentication = services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie(options =>
                {
                    options.Events.OnValidatePrincipal = LeagueAccess.RefreshAccountRole;
                    options.LoginPath = "/"; // Set the login page
                    options.AccessDeniedPath = ""; // Set the access denied page
                    if (PickupEnvironment.DisposableTest) options.Cookie.Name = ".LeagueHub.PickupTest";
                    options.Cookie.HttpOnly = true; // Ensure cookies are only accessible via HTTP
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // Require HTTPS for authentication cookies
                    options.Cookie.SameSite = SameSiteMode.Lax; // Adjust SameSite mode as needed
                    options.ExpireTimeSpan = TimeSpan.FromDays(30); // Set cookie expiration
                    options.Events.OnRedirectToLogin = context =>
                    {
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        return System.Threading.Tasks.Task.CompletedTask;
                    };
                    options.Events.OnRedirectToAccessDenied = context =>
                    {
                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        return System.Threading.Tasks.Task.CompletedTask;
                    };
                });

            GoogleSignIn.Configure(authentication, Configuration);

            services.AddMemoryCache();
            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = 429;
                options.AddPolicy("pickup-guest", context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromMinutes(5) }));
            });
            if (PickupEnvironment.DisposableTest)
                services.AddDataProtection().SetApplicationName(PickupEnvironment.Database)
                    .PersistKeysToFileSystem(Directory.CreateDirectory(Path.Combine(PickupEnvironment.LocalDirectory, "keys")));
            services.AddAuthorization(options =>
            {
                options.AddPolicy("LeagueManagement", policy =>
                {
                    policy.AddAuthenticationSchemes(CookieAuthenticationDefaults.AuthenticationScheme);
                    policy.RequireAuthenticatedUser();
                    policy.RequireRole("Admin", "Manager");
                });
            });

            services.AddHttpContextAccessor();
            services.AddSingleton(sp => Services.TransactionalMail.ConfigureClient(
                sp.GetRequiredService<IWebHostEnvironment>().EnvironmentName));
            services.AddSingleton<Services.TransactionalMail>();
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env, SmtpClient mail, Microsoft.Extensions.Logging.ILogger<Startup> logger)
        {
            var credential = mail.Credentials as System.Net.NetworkCredential;
            Microsoft.Extensions.Logging.LoggerExtensions.LogInformation(logger,
                "Transactional mail transport: {Mode}; host configured: {HostConfigured}; port: {Port}; STARTTLS: {StartTls}; authentication configured: {Authenticated}.",
                mail.DeliveryMethod, !string.IsNullOrWhiteSpace(mail.Host), mail.Port, mail.EnableSsl,
                !string.IsNullOrWhiteSpace(credential?.UserName) && !string.IsNullOrWhiteSpace(credential.Password));
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseExceptionHandler("/Error");
                app.UseHsts();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles(PwaStaticFiles());
            app.UseSpaStaticFiles(PwaStaticFiles());
            app.Use(async (context, next) =>
            {
                if (context.Request.Path.StartsWithSegments("/api") || context.Request.Path == GoogleSignIn.CallbackPath)
                {
                    context.Response.OnStarting(() =>
                    {
                        context.Response.Headers["Cache-Control"] = "no-store";
                        return System.Threading.Tasks.Task.CompletedTask;
                    });
                }
                await next();
            });
            app.UseRouting();
            app.UseRateLimiter();
            // The SPA shell has no identity-dependent content. Controllers and pages
            // still validate the cookie before authorization and endpoint execution.
            app.UseWhen(context => context.GetEndpoint() != null || context.Request.Path == GoogleSignIn.CallbackPath,
                branch => branch.UseAuthentication());
            app.Use(async (context, next) =>
            {
                if (!context.RequestAborted.IsCancellationRequested)
                    await next();
            });
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
                endpoints.MapControllerRoute(
                    name: "default",
                    pattern: "{controller}/{action=Index}/{id?}");
                endpoints.MapRazorPages();
            });

            app.Map("/api", fallback => fallback.Run(context =>
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return System.Threading.Tasks.Task.CompletedTask;
            }));
            app.UseSpa(spa =>
            {
                spa.Options.SourcePath = System.IO.Path.Combine(env.ContentRootPath, "ClientApp");
                spa.Options.DefaultPageStaticFileOptions = PwaStaticFiles();

                if (env.IsDevelopment() && !PickupEnvironment.DisposableTest)
                {
                    spa.UseAngularCliServer(npmScript: "start");
                }
            });
        }

        // Manifest MIME support on ASP.NET Core 2.2; revalidate PWA metadata on every deployment.
        // This applies only to static files, never authentication or API responses.
        private static StaticFileOptions PwaStaticFiles()
        {
            var types = new FileExtensionContentTypeProvider();
            types.Mappings[".webmanifest"] = "application/manifest+json";
            return new StaticFileOptions
            {
                ContentTypeProvider = types,
                OnPrepareResponse = context =>
                {
                    var name = context.File.Name;
                    if (name == "index.html" || name == "manifest.webmanifest" || name == "ngsw.json" ||
                        name == "ngsw-worker.js" || name == "safety-worker.js" || name == "worker-basic.min.js")
                    {
                        context.Context.Response.Headers["Cache-Control"] = "no-cache";
                    }
                    else if (System.Text.RegularExpressions.Regex.IsMatch(name, @"-[A-Z0-9]{8,}\.(?:js|css)$"))
                    {
                        context.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
                    }
                }
            };
        }
    }
}
