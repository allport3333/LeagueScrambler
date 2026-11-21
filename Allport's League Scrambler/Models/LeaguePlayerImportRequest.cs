using System.Collections.Generic;

namespace Allport_s_League_Scrambler.Models
{
    public class LeaguePlayerImportRequest
    {
        public List<LeaguePlayerImportEntry> Players { get; set; }
    }
    public class LeaguePlayerImportEntry
    {
        public int PlayerId { get; set; }
        public int DivisionId { get; set; }
    }
    public class LeaguePlayerDivisionRequest
    {
        public int DivisionId { get; set; }
        public int? ExpectedDivisionId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string ExpectedFirstName { get; set; }
        public string ExpectedLastName { get; set; }
    }
}
