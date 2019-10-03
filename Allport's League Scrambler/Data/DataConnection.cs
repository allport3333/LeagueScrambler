using Microsoft.IdentityModel.Protocols;
using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using System.Configuration;
using System.Data.Common;

namespace Allport_s_League_Scrambler.Data
{
    public class DataConnection
    {
        
        public static void CreateConnection()
        {
    
            string ConnStr = "Data Source = (localdb)\\LeagueDB; Initial Catalog = League; Integrated Security = True";


            string provider = ConfigurationManager.AppSettings["provider"];


            DbProviderFactory factory = DbProviderFactories.GetFactory(provider);
            using (DbConnection connection = factory.CreateConnection())
            {
                if(connection == null)
                {
                    Console.WriteLine("connection error");
                    Console.ReadLine();
                    return;
                }
                connection.ConnectionString = ConnStr;
                connection.Open();
                DbCommand command = factory.CreateCommand();
                if(command == null)
                {
                    Console.WriteLine("connection error");
                    Console.ReadLine();
                    return;
                }

            }
        }

    }
}
