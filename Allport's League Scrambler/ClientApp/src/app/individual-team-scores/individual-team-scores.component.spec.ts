import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndividualTeamScoresComponent } from './individual-team-scores.component';

describe('IndividualTeamScoresComponent', () => {
    let component: IndividualTeamScoresComponent;
    let fixture: ComponentFixture<IndividualTeamScoresComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(IndividualTeamScoresComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
