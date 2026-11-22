import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTests } from '../../test-support';
import { ScramblerComponent } from './scrambler.component';

describe('Scrambler setup after framework migration', () => {
 let fixture: ComponentFixture<ScramblerComponent>;
 beforeEach(async () => {
  await configureComponentTests();
  fixture = TestBed.createComponent(ScramblerComponent);
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
 });
 it('renders the existing setup with all four rules collapsed by default', () => {
  expect(fixture.nativeElement.textContent).toContain('Scrambler Setup');
  const rules = fixture.nativeElement.querySelector('details.scramble-rules');
  expect(rules.open).toBe(false);
  expect(rules.querySelectorAll('mat-checkbox').length).toBe(4);
 });
 it('retains an enabled rule while its disclosure closes and reopens', () => {
  const rules = fixture.nativeElement.querySelector('details.scramble-rules');
  rules.open = true;
  rules.dispatchEvent(new Event('toggle'));
  const option = Array.from(rules.querySelectorAll('mat-checkbox')).find((element: HTMLElement) => element.textContent.includes('Prioritize fewer')) as HTMLElement;
  option.querySelector('input').click();
  fixture.detectChanges();
  expect(fixture.componentInstance.prioritizePreviousTeammates).toBe(true);
  rules.open = false;
  rules.dispatchEvent(new Event('toggle'));
  rules.open = true;
  rules.dispatchEvent(new Event('toggle'));
  fixture.detectChanges();
  expect(fixture.componentInstance.prioritizePreviousTeammates).toBe(true);
  expect(rules.querySelector('summary').getAttribute('aria-expanded')).toBe('true');
 });
});
