import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { CombinedStatsTabComponent } from './combined-stats-tab.component';

describe('CombinedStatsTabComponent', () => {
  let component: CombinedStatsTabComponent;
  let fixture: ComponentFixture<CombinedStatsTabComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ CombinedStatsTabComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CombinedStatsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
