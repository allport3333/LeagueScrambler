import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueTeamStandingsComponent } from './league-team-standings.component';

describe('LeagueTeamStandingsComponent', () => {
    let component: LeagueTeamStandingsComponent;
    let fixture: ComponentFixture<LeagueTeamStandingsComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(LeagueTeamStandingsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
