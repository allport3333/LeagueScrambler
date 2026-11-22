import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueTeamPlayerScoresComponent } from './league-team-player-scores.component';

describe('LeagueTeamPlayerScoresComponent', () => {
    let component: LeagueTeamPlayerScoresComponent;
    let fixture: ComponentFixture<LeagueTeamPlayerScoresComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(LeagueTeamPlayerScoresComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
