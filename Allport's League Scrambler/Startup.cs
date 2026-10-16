using dotenv.net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SpaServices.AngularCli;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
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
            services.AddMvc().SetCompatibilityVersion(CompatibilityVersion.Version_2_1);
            services.AddSpaStaticFiles(configuration =>
            {
                configuration.RootPath = "ClientApp/dist";
            });

            // Configure authentication with cookie settings
            services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie(options =>
                {
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
                })
                .AddCookie("LeagueAdminPassword", options =>
                {
                    // A distinct short-lived credential for the existing administration password.
                    // This never overwrites an ordinary player's login.
                    options.Cookie.Name = "LeagueScrambler.Admin";
                    options.Cookie.HttpOnly = true;
                    options.Cookie.SameSite = SameSiteMode.Strict;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                    options.ExpireTimeSpan = TimeSpan.FromMinutes(20);
                    options.SlidingExpiration = false;
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
                    policy.AddAuthenticationSchemes(
                        CookieAuthenticationDefaults.AuthenticationScheme,
                        "LeagueAdminPassword");
                    policy.RequireAuthenticatedUser();
                    policy.RequireRole("Admin", "Manager", "LegacyAdmin");
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

        public void Configure(IApplicationBuilder app, IHostingEnvironment env)
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
            app.UseStaticFiles();
            app.UseSpaStaticFiles();
            app.UseAuthentication();

            app.UseMvc(routes =>
            {
                routes.MapRoute(
                    name: "default",
                    template: "{controller}/{action=Index}/{id?}");
            });

            app.UseSpa(spa =>
            {
                spa.Options.SourcePath = "ClientApp";

                if (env.IsDevelopment())
                {
                    spa.UseAngularCliServer(npmScript: "start");
                }
            });
        }
    }
}
