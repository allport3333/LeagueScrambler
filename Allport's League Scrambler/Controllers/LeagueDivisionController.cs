using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Allport_s_League_Scrambler.Data;
using Allport_s_League_Scrambler.Models;

namespace Allport_s_League_Scrambler.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LeagueDivisionController : ControllerBase
    {
        [HttpGet("GetByLeague/{leagueName}")]
        public IActionResult GetByLeague(string leagueName)
        {
            var context = new DataContext();

            if (string.IsNullOrWhiteSpace(leagueName))
            {
                return Ok(new object[] { });
            }

            var league = context.Leagues.Where(x => x.LeagueName == leagueName).FirstOrDefault();
            if (league == null)
            {
                return Ok(new object[] { });
            }

            var divisions = context.LeagueDivision
                .Where(x => x.LeagueID == league.ID)
                .OrderBy(x => x.SortOrder)
                .Select(x => new
                {
                    id = x.Id,
                    code = x.Code,
                    name = x.Name,
                    sortOrder = x.SortOrder
                })
                .ToList();

            return Ok(divisions);
        }

        [HttpPost("Add")]
        public IActionResult Add([FromBody] AddLeagueDivisionRequest request)
        {
            var context = new DataContext();

            if (request == null)
            {
                return BadRequest(new { message = "Request is required." });
            }

            if (request.LeagueId <= 0)
            {
                return BadRequest(new { message = "LeagueId is required." });
            }

            if (string.IsNullOrWhiteSpace(request.Code))
            {
                return BadRequest(new { message = "Code is required." });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Name is required." });
            }

            // Optional: prevent duplicates by Code per league
            var exists = context.LeagueDivision
                .Any(x => x.LeagueID == request.LeagueId && x.Code == request.Code);

            if (exists)
            {
                return BadRequest(new { message = "Division code already exists for this league." });
            }

            var newDivision = new LeagueDivision()
            {
                LeagueID = request.LeagueId,
                Code = request.Code,
                Name = request.Name,
                SortOrder = request.SortOrder
            };

            context.LeagueDivision.Add(newDivision);
            context.SaveChanges();

            return Ok(new { message = "Division added." });
        }
    }
}