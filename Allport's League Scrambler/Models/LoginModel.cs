using Allport_s_League_Scrambler.Models;
using System;

namespace Allport_s_League_Scrambler.Models
{
    public class LoginModel
    {
        public string Email { get; set; } 
        public string Password { get; set; }
        public bool RememberMe { get; set; }
    }

}
