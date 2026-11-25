using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
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
                if (!Pickup.PickupEnvironment.Requested) throw new InvalidOperationException("Select the Pickup Development profile.");
                using var host = CreateHostBuilder(Array.Empty<string>()).Build();
                Pickup.PickupEnvironment.Configure((IWebHostEnvironment)host.Services.GetService(typeof(IWebHostEnvironment)));
                Pickup.PickupEnvironment.Initialize();
                return;
            }
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(web => web.UseStartup<Startup>());
    }
}
