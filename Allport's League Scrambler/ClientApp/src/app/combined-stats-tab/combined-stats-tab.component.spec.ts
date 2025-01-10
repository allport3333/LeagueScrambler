import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CombinedStatsTabComponent } from './combined-stats-tab.component';

describe('CombinedStatsTabComponent', () => {
  let component: CombinedStatsTabComponent;
  let fixture: ComponentFixture<CombinedStatsTabComponent>;

  beforeEach(async(() => {
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
