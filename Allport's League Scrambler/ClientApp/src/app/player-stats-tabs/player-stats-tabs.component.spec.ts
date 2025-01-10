import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerStatsTabsComponent } from './player-stats-tabs.component';

describe('PlayerStatsTabsComponent', () => {
  let component: PlayerStatsTabsComponent;
  let fixture: ComponentFixture<PlayerStatsTabsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlayerStatsTabsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayerStatsTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
