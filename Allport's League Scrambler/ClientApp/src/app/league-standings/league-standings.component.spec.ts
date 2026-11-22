import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueStandingsComponent } from './league-standings.component';

describe('LeagueStandingsComponent', () => {
    let component: LeagueStandingsComponent;
    let fixture: ComponentFixture<LeagueStandingsComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(LeagueStandingsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
