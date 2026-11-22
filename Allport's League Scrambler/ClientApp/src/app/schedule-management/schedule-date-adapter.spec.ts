import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { ScheduleDateAdapter } from './schedule-date-adapter';

describe('ScheduleDateAdapter after the Material constructor migration', () => {
 let adapter: ScheduleDateAdapter;
 beforeEach(() => {
  TestBed.configureTestingModule({ providers: [ScheduleDateAdapter, { provide: MAT_DATE_LOCALE, useValue: 'en-US' }] });
  adapter = TestBed.inject(ScheduleDateAdapter);
 });
 it('keeps a typed ISO date at local midnight rather than parsing it as UTC', () => {
  const date = adapter.parse('2027-05-23');
  expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2027, 4, 23, 0]);
 });
 it('rejects impossible dates and accepts a real leap day', () => {
  expect(adapter.isValid(adapter.parse('2027-02-30'))).toBe(false);
  const leap = adapter.parse('2028-02-29');
  expect([leap.getFullYear(), leap.getMonth(), leap.getDate()]).toEqual([2028, 1, 29]);
 });
 it('retains native date parsing and the injected locale', () => {
  const date = adapter.parse('5/23/2027');
  expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 4, 23]);
  expect(adapter.getMonthNames('long')[0]).toBe('January');
 });
});
