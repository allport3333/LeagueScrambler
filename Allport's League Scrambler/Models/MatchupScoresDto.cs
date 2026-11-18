using System;
using System.Collections.Generic;

namespace Allport_s_League_Scrambler.Models
{
    public class MatchupScoresDto
    {
        public int LeagueId { get; set; }
        public int Team1Id { get; set; }
        public int Team2Id { get; set; }
        // Calendar date, deliberately without timezone conversion.
        public string Date { get; set; }
        public int? ScheduleId { get; set; }
        public List<MatchupGameDto> Games { get; set; }
    }

    public class MatchupGameDto
    {
        public int? Team1Score { get; set; }
        public int? Team2Score { get; set; }
    }
}
