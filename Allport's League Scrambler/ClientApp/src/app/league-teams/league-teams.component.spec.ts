import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueTeamsComponent } from './league-teams.component';

describe('LeagueTeamsComponent', () => {
    let component: LeagueTeamsComponent;
    let fixture: ComponentFixture<LeagueTeamsComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(LeagueTeamsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
