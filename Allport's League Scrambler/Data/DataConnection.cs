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
            //SqlConnection conn = new SqlConnection();
            //conn.ConnectionString =
            //"Data Source==LeagueScrambler.mssql.somee.com;" +
            //"Initial Catalog=LeagueScrambler;" +
            //"User id=allport;" +
            //workstation id = LeagueScrambler.mssql.somee.com;
            //conn.Open();



            string ConnStr = Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION");
            string provider = ConfigurationManager.AppSettings["provider"];


            DbProviderFactory factory = DbProviderFactories.GetFactory(provider);
            using (DbConnection connection = factory.CreateConnection())
            {
                if (connection == null)
                {
                    Console.WriteLine("connection error");
                    Console.ReadLine();
                    return;
                }
                connection.ConnectionString = ConnStr;
                connection.Open();
                DbCommand command = factory.CreateCommand();
                if (command == null)
                {
                    Console.WriteLine("connection error");
                    Console.ReadLine();
                    return;
                }

            }
        }

    }
}
