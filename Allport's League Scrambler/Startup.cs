using dotenv.net;
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
        public Startup(IConfiguration configuration)
        {
            DotEnv.Load(options: new DotEnvOptions(probeForEnv: true, probeLevelsToSearch: 6));

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
            services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie(options =>
                {
                    options.Events.OnValidatePrincipal = LeagueAccess.RefreshAccountRole;
                    options.LoginPath = "/"; // Set the login page
                    options.AccessDeniedPath = ""; // Set the access denied page
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

            services.AddMemoryCache();
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
            string smtpServer = Environment.GetEnvironmentVariable("SMTP_SERVER");
            string smtpPort = Environment.GetEnvironmentVariable("SMTP_PORT");
            string smtpUsername = Environment.GetEnvironmentVariable("SMTP_USERNAME");
            string smtpPassword = Environment.GetEnvironmentVariable("SMTP_PASSWORD");

            services.AddSingleton(new SmtpClient(Environment.GetEnvironmentVariable("SMTP_SERVER"),
                                                 int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? "587"))
            {
                Credentials = new System.Net.NetworkCredential(
                    Environment.GetEnvironmentVariable("SMTP_USERNAME"),
                    Environment.GetEnvironmentVariable("SMTP_PASSWORD")),
                EnableSsl = true
            });
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
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
                if (context.Request.Path.StartsWithSegments("/api"))
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
            // The SPA shell has no identity-dependent content. Controllers and pages
            // still validate the cookie before authorization and endpoint execution.
            app.UseWhen(context => context.GetEndpoint() != null, branch => branch.UseAuthentication());
            app.Use(async (context, next) =>
            {
                if (!context.RequestAborted.IsCancellationRequested)
                    await next();
            });
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllerRoute(
                    name: "default",
                    pattern: "{controller}/{action=Index}/{id?}");
                endpoints.MapRazorPages();
            });

            app.UseSpa(spa =>
            {
                spa.Options.SourcePath = System.IO.Path.Combine(env.ContentRootPath, "ClientApp");
                spa.Options.DefaultPageStaticFileOptions = PwaStaticFiles();

                if (env.IsDevelopment())
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
