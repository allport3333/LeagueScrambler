using Allport_s_League_Scrambler.Models;
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace Allport_s_League_Scrambler.Models
{
    public class UserRoles
    {
        // Define primary key using [Key]
        [Key]
        public int UserRoleId { get; set; }

        // Role name property
        public string RoleName { get; set; }
    }
}


