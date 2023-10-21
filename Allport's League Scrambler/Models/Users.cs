using System;
using System.Collections.Generic;

namespace Allport_s_League_Scrambler.Models
{
    public class User
    {
        public int UserId { get; set; } // Unique user identifier
        public string LoginName { get; set; } // User's login name or username
        public byte[] PasswordHash { get; set; } // Hashed password
        public byte[] PasswordSalt { get; set; } // Password salt
        public string Email { get; set; } // User's email address
        public string FirstName { get; set; } // User's first name
        public string LastName { get; set; } // User's last name
        public bool IsAdmin { get; set; } // User's role (admin, user, etc.)
        public DateTime CreatedAt { get; set; } // User account creation date
        public DateTime LastLogin { get; set; } // Date of the user's last login

    }

}
