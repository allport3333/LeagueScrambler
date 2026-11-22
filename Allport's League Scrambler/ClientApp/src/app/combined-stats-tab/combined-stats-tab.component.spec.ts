import { configureComponentTests } from '../../test-support';
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CombinedStatsTabComponent } from './combined-stats-tab.component';

describe('CombinedStatsTabComponent', () => {
    let component: CombinedStatsTabComponent;
    let fixture: ComponentFixture<CombinedStatsTabComponent>;

    beforeEach(async () => {
        await configureComponentTests();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(CombinedStatsTabComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
