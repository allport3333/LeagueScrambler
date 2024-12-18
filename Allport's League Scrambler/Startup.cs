using dotenv.net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
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
            DotEnv.Load();

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
                    options.Cookie.SecurePolicy = CookieSecurePolicy.None; // Allow cookies over HTTP (for development)
                    options.Cookie.SameSite = SameSiteMode.Lax; // Adjust SameSite mode as needed
                    options.ExpireTimeSpan = TimeSpan.FromDays(30); // Set cookie expiration
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
