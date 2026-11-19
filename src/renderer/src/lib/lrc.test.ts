import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseLrc, activeLineIndex, wordProgress } from './lrc.ts'

test('parses timestamps, sorts, and sets line ends', () => {
  const lines = parseLrc('[ar: Someone]\n[00:12.50]Second line here\n[00:05.00]First line\n[00:20.00]', 30)
  assert.equal(lines.length, 3)
  assert.equal(lines[0].text, 'First line')
  assert.equal(lines[0].start, 5)
  assert.equal(lines[0].end, 12.5)
  assert.equal(lines[2].text, '')
  assert.equal(lines[2].end, 30)
})

test('repeated timestamps on one line', () => {
  const lines = parseLrc('[00:01.00][00:10.00]Chorus\n[00:05.00]Verse')
  assert.deepEqual(lines.map((l) => [l.start, l.text]), [[1, 'Chorus'], [5, 'Verse'], [10, 'Chorus']])
})

test('estimated words cover the sung part of the line in order', () => {
  const [line] = parseLrc('[00:00.00]Hello there my friend\n[00:20.00]x')
  assert.equal(line.words.length, 4)
  assert.equal(line.words[0].start, 0)
  assert.ok(line.singEnd < 5, 'long gap should not stretch the line')
  assert.ok(Math.abs(line.words[3].end - line.singEnd) < 1e-9)
  for (let i = 1; i < 4; i++) assert.ok(line.words[i].start >= line.words[i - 1].start)
})

test('enhanced word tags', () => {
  const [line] = parseLrc('[00:01.00]<00:01.00>Hey <00:01.50>you <00:02.20>there\n[00:04.00]next')
  assert.deepEqual(line.words.map((w) => [w.text, w.start]), [['Hey', 1], ['you', 1.5], ['there', 2.2]])
  assert.equal(line.words[0].end, 1.5)
  assert.equal(line.text, 'Hey you there')
})

test('active line and word progress', () => {
  const lines = parseLrc('[00:01.00]a\n[00:03.00]b\n[00:05.00]c')
  assert.equal(activeLineIndex(lines, 0.5), -1)
  assert.equal(activeLineIndex(lines, 3), 1)
  assert.equal(activeLineIndex(lines, 99), 2)
  assert.equal(wordProgress({ text: 'x', start: 1, end: 3 }, 2), 0.5)
})
