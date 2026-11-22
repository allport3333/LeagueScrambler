import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateTeamsComponent } from './create-teams.component';

describe('CreateTeamsComponent', () => {
    let component: CreateTeamsComponent;
    let fixture: ComponentFixture<CreateTeamsComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(CreateTeamsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
