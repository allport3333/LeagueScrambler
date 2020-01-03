using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class TeamScore
    {
        public int Id { get; set; }
        public int Team1ID { get; set; }
        public int Team2ID { get; set; }
        public int Team1Score { get; set; }
        public int Team2Score { get; set; }
        public DateTime Date { get; set; }

    }
}
