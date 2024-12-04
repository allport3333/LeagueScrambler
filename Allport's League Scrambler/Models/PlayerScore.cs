﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Models
{
    public class PlayerScore
    {
        public int Id { get; set; }
        public int PlayersLeagueID { get; set; }
        public int PlayersTotalRoundScore { get; set; }
        public DateTime Date { get; set; }
        public int? KingQueenPlayerId { get; set; }
        public KingQueenPlayer KingQueenPlayer { get; set; }

    }
}
