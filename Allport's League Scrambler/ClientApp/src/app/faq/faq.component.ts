import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { LeagueService } from '../services/league.service';
interface FAQPart {text:string;route?:string;query?:any;}
interface FAQItem {id:string;question:string;answer:FAQPart[];expanded:boolean;}
interface FAQCategory {id:string;title:string;items:FAQItem[];}
@Component({selector:'app-faq',templateUrl:'./faq.component.html',styleUrls:['./faq.component.css']})
export class FaqComponent implements OnInit,OnDestroy {
 selectedLeagueId:number=null;private subscription:Subscription;
 readonly categories:FAQCategory[]=[
  {
    "id": "getting-started",
    "title": "Getting Started",
    "items": [
      {
        "id": "navigation",
        "question": "How do I find pages and choose a league?",
        "answer": [
          {
            "text": "Use the league selector to choose the league you want to view. On desktop, available pages appear across the navigation bar; More appears only when the links do not fit. On a phone, open the hamburger menu. Some destinations depend on your account permissions."
          }
        ],
        "expanded": false
      },
      {
        "id": "own-profile",
        "question": "How do I find my own player profile?",
        "answer": [
          {
            "text": "After you log in with a regular Player account linked to a player, the application opens your profile for the associated league selected during login, normally your most recent league. You can return through Account > Profile on desktop or Profile in the mobile menu. Use the league selector to view another league you belong to. If your account has no linked player, contact your organizer for help claiming the correct profile."
          }
        ],
        "expanded": false
      },
      {
        "id": "personal-statistics",
        "question": "Where do I view my personal statistics?",
        "answer": [
          {
            "text": "Your profile has three tabs: King/Queen Stats for saved K/Q rounds, matchups and teammates; League Team Stats for recorded team game results; and League Player Stats for game summaries, streaks, opponent records and teammate statistics. Statistics are shown for the selected league."
          }
        ],
        "expanded": false
      },
      {
        "id": "other-players",
        "question": "How do I view another player's statistics?",
        "answer": [
          {
            "text": "Open "
          },
          {
            "text": "Players",
            "route": "/fetch-data"
          },
          {
            "text": ", search for the player, and select their entry. You can also open a profile from "
          },
          {
            "text": "K/Q Standings",
            "route": "/standings"
          },
          {
            "text": ": click a name on desktop or in View Full Table. In the compact mobile standings, tap the name to expand scores, then select View Profile. The profile opens King/Queen Stats; League Team Stats and League Player Stats remain available. Separate players with the same name have separate profiles."
          }
        ],
        "expanded": false
      }
    ]
  },
  {
    "id": "league-night",
    "title": "League Night",
    "items": [
      {
        "id": "next-game",
        "question": "How do I see who I'm playing next?",
        "answer": [
          {
            "text": "Your Next Game on your profile shows the earliest upcoming scheduled matchup involving your team in the selected league, including games scheduled for today. It shows your team, opponent, date, week and division when available. Multiple games on that date are listed. View Full Schedule opens the matching week with all of its matchups in "
          },
          {
            "text": "League Dashboard",
            "route": "/league-dashboard",
            "query": {
              "tab": "schedule"
            }
          },
          {
            "text": ". Schedule dates do not imply a game start time."
          }
        ],
        "expanded": false
      },
      {
        "id": "no-upcoming",
        "question": "Why does my profile say No Upcoming Games?",
        "answer": [
          {
            "text": "Your player may not have an assigned league team, your team may have no remaining upcoming matchups, or the league may have no available schedule. A bye week is skipped when searching for the next game. King/Queen scramble leagues do not necessarily use fixed scheduled teams, so an opponent is not invented for them. A failed request shows a separate error and retry option."
          }
        ],
        "expanded": false
      },
      {
        "id": "schedule",
        "question": "Where can I find the full league schedule?",
        "answer": [
          {
            "text": "Open "
          },
          {
            "text": "League Dashboard",
            "route": "/league-dashboard",
            "query": {
              "tab": "schedule"
            }
          },
          {
            "text": " and select Schedule. Use the previous/next arrows or the week-and-date dropdown to browse available scheduled weeks. Normal schedule loading selects the date closest to today, which may be past or future. View Full Schedule from a profile instead selects the week containing that upcoming matchup. The full week remains visible, not just your game."
          }
        ],
        "expanded": false
      },
      {
        "id": "phone-attendance",
        "question": "How do I sign in for league night on my phone?",
        "answer": [
          {
            "text": "Log in to your account and open your own player profile. When attendance is available, select the green Sign In for Tonight button under League Night Sign In. Wait for Signed In for Tonight to confirm that attendance was saved. Logging into your account alone does not sign you in for league night. The existing "
          },
          {
            "text": "Sign In Sheet",
            "route": "/sign-in"
          },
          {
            "text": " is also available; organizers can continue using it for attendance."
          }
        ],
        "expanded": false
      },
      {
        "id": "attendance-unavailable",
        "question": "Why can't I sign in for league night?",
        "answer": [
          {
            "text": "Self sign-in is available only on the selected league's configured day and while an administrator has not locked attendance. The league day uses the Eastern (America/New_York) calendar, including daylight saving time. Your profile shows an opens-on-day message or a distinct lock explanation. Your account must be linked to the player whose profile you are viewing, and that player must belong to the league. If eligibility or attendance cannot be verified, use the retry option or contact your organizer; no enabled button is shown before checks complete."
          }
        ],
        "expanded": false
      },
      {
        "id": "attendance-status",
        "question": "How do I know if I'm already signed in?",
        "answer": [
          {
            "text": "Your own profile displays the green Signed In for Tonight confirmation after checking the current attendance record. Refreshing the page checks again. Your profile, the "
          },
          {
            "text": "Sign In Sheet",
            "route": "/sign-in"
          },
          {
            "text": " and the administrator attendance list use the same records, so an organizer's sign-in also appears on your profile. You do not need to sign in twice."
          }
        ],
        "expanded": false
      },
      {
        "id": "remove-attendance",
        "question": "Can I remove my league-night sign-in?",
        "answer": [
          {
            "text": "When removal is permitted, select the secondary Remove Sign In action on your own profile and confirm. The profile refreshes attendance afterward. Removal is unavailable when attendance is locked or the applicable self-service rules do not allow it. You cannot change another player's attendance from their statistics profile."
          }
        ],
        "expanded": false
      }
    ]
  },
  {
    "id": "standings-statistics",
    "title": "Standings and Statistics",
    "items": [
      {
        "id": "standings",
        "question": "Where can I check K/Q standings?",
        "answer": [
          {
            "text": "Open "
          },
          {
            "text": "K/Q Standings",
            "route": "/standings"
          },
          {
            "text": " for the selected league. Choose Overall or an available division, then Men's or Women's standings. Use the Round/Matchup toggle and sorting controls to explore the scores. On a phone, tap a player to expand individual scores; View Full Table provides the detailed, horizontally scrollable table."
          }
        ],
        "expanded": false
      },
      {
        "id": "historical-matchups",
        "question": "How do I view historical K/Q matchups?",
        "answer": [
          {
            "text": "Select a linked individual score in standings to open the exact saved matchup in "
          },
          {
            "text": "K/Q Matchups",
            "route": "/kqmatchups"
          },
          {
            "text": ". A round link highlights its saved round; a matchup-total link shows the original round results. View All Matchups restores the full week, and selecting another week shows its complete matchup list. You can also open K/Q Matchups normally and choose a saved week. Placeholder scores without a saved association are not linked."
          }
        ],
        "expanded": false
      },
      {
        "id": "individual-rounds",
        "question": "How do I inspect individual rounds and teammates?",
        "answer": [
          {
            "text": "On a player profile, open King/Queen Stats and expand a matchup in the chronological history to see raw round scores, recorded win results and teammates. Teammate names link to their profiles. View Detailed Round Table groups all saved rounds by matchup date; separate saved scrambles on the same date stay separate. Where saved team information is available, linked scores also open the original matchup."
          }
        ],
        "expanded": false
      },
      {
        "id": "substitute-adjustments",
        "question": "How do substitute scores affect standings and personal statistics?",
        "answer": [
          {
            "text": "K/Q Standings applies the selected league's Number of Subs Allowed, Percent of Score for Subs and Drop Lowest Scores settings. Eligible substitute score entries beyond the allowance use the configured percentage; the values are not universal across leagues. King/Queen Stats and historical K/Q Matchups show original saved round results, so they can differ from adjusted standings. Ask your organizer which published rules and settings apply to your league."
          }
        ],
        "expanded": false
      },
      {
        "id": "substitute-statistics",
        "question": "Where can I see substitute information?",
        "answer": [
          {
            "text": "In "
          },
          {
            "text": "K/Q Standings",
            "route": "/standings"
          },
          {
            "text": ", purple highlighting identifies substitute scores. Expanded mobile details include Substitute and Reduced labels where applicable; the detailed table uses the same score meanings. In "
          },
          {
            "text": "K/Q Matchups",
            "route": "/kqmatchups"
          },
          {
            "text": ", a yellow Sub badge identifies a recorded substitute team member. There is no separate substitute-only statistics report or filter on player profiles; their King/Queen history preserves raw saved scores."
          }
        ],
        "expanded": false
      },
      {
        "id": "dropped-scores",
        "question": "What do dropped and reduced scores mean?",
        "answer": [
          {
            "text": "Red identifies dropped scores and reduced substitute scores; a substitute score can also keep its purple background. Dropped entries stay visible but are excluded from the adjusted King Queen Score. Reduced entries use the league's substitute percentage. Total Points shows the saved score total before those standings adjustments, while King Queen Score reflects them. Use the legend and check the selected league's rules before comparing different leagues or Round/Matchup views."
          }
        ],
        "expanded": false
      },
      {
        "id": "scramble-randomness",
        "question": "Are K/Q teams completely random?",
        "answer": [
          {
            "text": "The Scrambler uses Math.random for player choices and some tie-breaking, but team-size, balancing, Top/Low/Bye preferences, selected settings and saved scramble history can constrain the result. The Completely Random and Lock Results options also affect the workflow. Random selection does not guarantee different teammates each week or that every possible team is equally likely. Organizers can use the existing no-duplicate-team workflow against selected saved scrambles when the available players and constraints permit it."
          }
        ],
        "expanded": false
      },
      {
        "id": "league-rules",
        "question": "Where can I find official league rules and revisions?",
        "answer": [
          {
            "text": "Ask your league organizer for the current published rules and any revisions. There is no dedicated rules/revisions section in the current League Dashboard. This FAQ explains application behavior; it does not replace league rules. Substitute allowances, score reductions, dropped scores and league-night procedures may vary by league."
          }
        ],
        "expanded": false
      }
    ]
  }
];
 constructor(private leagues:LeagueService){}
 ngOnInit(){this.subscription=this.leagues.selectedLeague$.subscribe(selected=>this.selectedLeagueId=selected.leagueId);}
 toggleItem(item:FAQItem){item.expanded=!item.expanded;}
 navigationQuery(part:FAQPart):any{return {...(this.selectedLeagueId?{leagueId:this.selectedLeagueId}:{}),...(part.query||{})};}
 ngOnDestroy(){if(this.subscription)this.subscription.unsubscribe();}
}
