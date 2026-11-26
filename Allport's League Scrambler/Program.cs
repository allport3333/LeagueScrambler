using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;

namespace Allport_s_League_Scrambler
{
    public class Program
    {
        public static void Main(string[] args)
        {
            if (args.Contains("--initialize-pickup"))
            {
                if (!Pickup.PickupEnvironment.DisposableTest)
                    throw new InvalidOperationException("Pickup initialization requires the disposable test host.");
                using var host = CreateHostBuilder(Array.Empty<string>()).Build();
                Pickup.PickupEnvironment.Configure((IWebHostEnvironment)host.Services.GetService(typeof(IWebHostEnvironment)));
                Pickup.PickupEnvironment.Initialize();
                return;
            }
            using var application = CreateHostBuilder(args).Build();
            var normalDevelopment = application.Services.GetRequiredService<IHostEnvironment>().IsDevelopment() &&
                !Pickup.PickupEnvironment.DisposableTest;
            try
            {
                application.Run();
            }
            catch (IOException ex) when (normalDevelopment && ex.InnerException is AddressInUseException)
            {
                Console.Error.WriteLine("League Hub could not start because port 5001 is already in use. Stop the existing Visual Studio debugging session or press Ctrl+C in the terminal that started League Hub, then try again.");
                Environment.ExitCode = 1;
            }
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(web => web.UseStartup<Startup>());
    }
}
