import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { StatisticsService } from '../services/statistics.service';
import { WeekSchedule } from '../data-models/DTOs';

@Component({
    selector: 'app-league-schedule',
    templateUrl: './league-schedule.component.html',
    styleUrls: ['./league-schedule.component.css'],
})
export class LeagueScheduleComponent implements OnInit {
    @Input() leagueId: number | null = null;

    loading: boolean = false;
    schedule: WeekSchedule[] = [];
    activeTabIndex: number = 0; // Index of the active tab

    constructor(private statisticsService: StatisticsService) { }

    ngOnInit(): void {
        if (this.leagueId) {
            this.loadSchedule();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['leagueId'] && changes['leagueId'].currentValue) {
            this.loadSchedule();
        }
    }

    private loadSchedule(): void {
        if (!this.leagueId) return;

        this.loading = true;
        this.statisticsService.getLeagueSchedule(this.leagueId).subscribe({
            next: (data) => {
                this.schedule = data;
                this.setClosestWeekAsActiveTab();
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching schedule:', err);
                this.loading = false;
            },
        });
    }

    private setClosestWeekAsActiveTab(): void {
        const today = new Date();
        let closestIndex = 0;
        let closestDifference = Number.MAX_VALUE;

        this.schedule.forEach((week, index) => {
            const weekDate = new Date(week.date);
            const difference = Math.abs(weekDate.getTime() - today.getTime());

            if (difference < closestDifference) {
                closestIndex = index;
                closestDifference = difference;
            }
        });

        this.activeTabIndex = closestIndex;
    }
}
