import { Component, OnInit } from '@angular/core';
interface FAQItem {
    question: string;
    answer: string;
    expanded: boolean;
}

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.css']
})

export class FaqComponent implements OnInit {
    faqItems: FAQItem[] = [];

    ngOnInit(): void {
        this.faqItems = [
            {
                question: 'Where can I check my KQ standing?',
                answer: 'You can view your current KQ standing by clicking the K/Q Standings button at the top, within the menu.',
                expanded: false
            },
            {
                question: 'Where can I check my past KQ match ups?',
                answer: 'Past KQ teams can be found on your profile. Click on the week in question and it will show you who was on your team.',
                expanded: false
            },
            {
                question: 'Where is the team league schedule located?',
                answer: 'The team league schedule is available on the league dashboard page under the "Schedule" tab.',
                expanded: false
            },
            {
                question: 'How do I look up other players stats?',
                answer: 'Visit the Players section by clicking Players at the top of the page and search for a player to view their public stats and game history.',
                expanded: false
            },
            {
                question: 'Where can I find more details on KQ randomness or selection?',
                answer: 'The draws through the scrambler are completely random using a combination of Math.random calls on both the player list, and the team list. There is an option to enforce no duplicate teams for as many draws as the numbers allow.',
                expanded: false
            },
            {
                question: 'Where are the latest rules and rule revisions updates?',
                answer: 'Rules for the specific league will be under the league dashboard if they have been provided by the admin for your league.',
                expanded: false
            },
            {
                question: 'Where do I look up my stats?',
                answer: 'You can find your full stat breakdown on your player profile page under the "King/Queen Stats", "League Team Stats", and "LeaguePlayer Stats" tab.',
                expanded: false
            },
            {
                question: 'How are sub stats factored into my stats as a player? Versus for the league?',
                answer: 'Sub stats count toward your personal performance history but may be treated differently in official league standings. Refer to the rules for details (for example, one league may have all subs past 2 count for half points in K/Q Standings)',
                expanded: false
            },
            {
                question: 'Is there a way to look up sub stats?',
                answer: 'Not currently.',
                expanded: false
            },
            {
                question: 'Signing in to KQ through the application on your phone.',
                answer: 'Sign in is locked on all days but the day your league is, also, your league admin may lock sign in manually so people do not sign in past the leagues specific sign in lock time. If your league has yet to start, and is still locked, please contact your league admin.',
                expanded: false
            },
        ];
    }

    toggleItem(index: number): void {
        this.faqItems[index].expanded = !this.faqItems[index].expanded;
    }
}
