import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Modal,
  Keyboard,
  Platform,
  TextInput,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Game, Entry, cellKey, entryCells, getGamePuzzle } from "../game";
import { colors, fonts } from "../theme";
import { Button } from "./Button";
import { boardGeometry, cellTypography } from "../layout";
export function PuzzleScreen({
  game,
  tactileFeedback,
  onCell,
  onBack,
}: {
  game: Game;
  tactileFeedback: boolean;
  onCell: (key: string, value: string) => Game | undefined;
  onBack: () => void;
}) {
  const p = getGamePuzzle(game),
    { height, fontScale } = useWindowDimensions();
  const nativeKeyboard = Platform.OS === "ios";
  const done = !!game.completedAt;
  const input = useRef<TextInput>(null);
  const latestGame = useRef(game);
  const [cursor, setCursor] = useState({
      entryIndex: 0,
      selected: entryCells(p.entries[0])[0],
    }),
    [showClues, setShowClues] = useState(false),
    [checking, setChecking] = useState(false),
    [playArea, setPlayArea] = useState<{ width: number; height: number; windowHeight: number }>(),
    [waitingForKeyboard, setWaitingForKeyboard] = useState(nativeKeyboard && !done);
  const latestCursor = useRef(cursor);
  const { entryIndex, selected } = cursor;
  const entry = p.entries[entryIndex];
  const activeCells = entryCells(entry);
  useEffect(() => {
    if (!waitingForKeyboard) return;
    const ready = () => setWaitingForKeyboard(false);
    const subscription = Keyboard.addListener("keyboardDidShow", ready);
    // A hardware keyboard can take focus without a software keyboard event.
    const timer = setTimeout(ready, 500);
    if (Keyboard.isVisible()) ready();
    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, [waitingForKeyboard]);
  function measurePlayArea(width: number, playHeight: number) {
    setPlayArea((previous) => {
      const sameWindow = previous?.width === width && previous.windowHeight === height;
      // Keep the playing size when the keyboard is dismissed or the clue sheet opens.
      const availableHeight = nativeKeyboard && sameWindow
        ? Math.min(previous.height, playHeight)
        : playHeight;
      return sameWindow && previous.height === availableHeight
        ? previous
        : { width, height: availableHeight, windowHeight: height };
    });
  }
  const { boardWidth, cellSize } = boardGeometry(
    playArea?.width ?? 0,
    playArea?.height ?? 0,
    p.size
  );
  const typography = cellTypography(cellSize);
  function moveCursor(entryIndex: number, selected: string) {
    const next = { entryIndex, selected };
    latestCursor.current = next;
    setCursor(next);
  }
  function selectEntry(index: number) {
    moveCursor(index, entryCells(p.entries[index])[0]);
  }
  function stepClue(step: number) {
    selectEntry((latestCursor.current.entryIndex + p.entries.length + step) % p.entries.length);
    input.current?.focus();
  }
  function selectCell(key: string) {
    const { entryIndex, selected } = latestCursor.current;
    const matches = p.entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => entryCells(e).includes(key));
    const same = matches.find(({ i }) => i === entryIndex);
    const next =
      key === selected && same
        ? matches.find(({ i }) => i !== entryIndex) ?? same
        : same ?? matches[0];
    if (next) {
      moveCursor(next.i, key);
      input.current?.focus();
    }
  }
  function playKeyFeedback() {
    if (tactileFeedback && Platform.OS !== "web")
      void Haptics.selectionAsync().catch(() => {});
  }
  function type(letter: string) {
    const { cells, completedAt } = latestGame.current;
    if (completedAt) return;
    setChecking(false);
    const { entryIndex, selected } = latestCursor.current;
    const activeCells = entryCells(p.entries[entryIndex]);
    const index = activeCells.indexOf(selected);
    if (letter === "⌫") {
      const target = cells[selected] ? selected : activeCells[index - 1];
      if (!target) return;
      moveCursor(entryIndex, target);
      latestGame.current = onCell(target, "") ?? latestGame.current;
      return;
    }
    latestGame.current = onCell(selected, letter) ?? latestGame.current;
    if (index < activeCells.length - 1) moveCursor(entryIndex, activeCells[index + 1]);
    else {
      const nextIndex = p.entries.findIndex(
        (e, i) =>
          i > entryIndex &&
          entryCells(e).some((k) => !latestGame.current.cells[k])
      );
      if (nextIndex >= 0) selectEntry(nextIndex);
    }
  }
  function openClues() {
    input.current?.blur();
    setShowClues(true);
  }
  const check = () => setChecking((value) => !value);
  const incorrect = Object.entries(game.cells)
    .filter(([key, value]) => {
      const [r, c] = key.split(",").map(Number);
      return value && value !== p.rows[r][c];
    })
    .map(([key]) => key);
  const filled = p.rows.every((row, r) =>
    [...row].every((v, c) => v === "." || Boolean(game.cells[cellKey(r, c)]))
  );
  const caption = done
    ? "Complete ✓"
    : checking
    ? incorrect.length
      ? "Try the marked squares"
      : "Looking good"
    : filled
    ? "Almost. Check your letters."
    : null;
  const clueLabel = `${entry.number} ${entry.direction.toUpperCase()} · ${entry.answer.length}`;
  const clueBarHeight = 10 + 54 * Math.min(fontScale, 1.5);
  function clueLine(e: Entry, i: number) {
    return (
      <Pressable
        key={`${e.number}${e.direction}`}
        accessibilityRole="button"
        onPress={() => {
          selectEntry(i);
          setShowClues(false);
        }}
        style={[
          s.clueRow,
          i === entryIndex && { backgroundColor: colors.highlight },
        ]}
      >
        <Text style={s.clueNumber}>{e.number}</Text>
        <Text style={s.clueText}>
          {e.clue} <Text style={s.length}>({e.answer.length})</Text>
        </Text>
      </Pressable>
    );
  }
  return (
    <View style={s.screen}>
      <View style={s.top}>
        <Button quiet label="‹ Home" onPress={onBack} />
        <Text numberOfLines={1} style={s.heading}>Puzzle {String(p.id).padStart(3, "0")}</Text>
        <View style={s.topActions}>
          <Button quiet label="Clues" onPress={openClues} />
          {!done && <Button quiet label="Check" onPress={check} />}
        </View>
      </View>
      <View
        style={s.playArea}
        onLayout={({ nativeEvent: { layout } }) => measurePlayArea(layout.width, layout.height)}
      >
        {!waitingForKeyboard && boardWidth > 0 && <ScrollView
          style={{ width: boardWidth, height: boardWidth, flexGrow: 0 }}
          minimumZoomScale={1}
          maximumZoomScale={3}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          bounces={false}
          accessibilityHint="Pinch to enlarge the crossword grid"
        >
          <View style={[s.board, { width: boardWidth, height: boardWidth }]}>
            {p.rows.map((row, r) => (
              <View
                key={r}
                style={{
                  flexDirection: "row",
                  height: cellSize,
                  width: boardWidth,
                }}
              >
                {[...row].map((letter, c) => {
                  const key = cellKey(r, c),
                    number = p.entries.find(
                      (e) => e.row === r && e.col === c
                    )?.number;
                  if (letter === ".")
                    return (
                      <View
                        key={key}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: colors.ink,
                        }}
                      />
                    );
                  const error = checking && incorrect.includes(key);
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Row ${r + 1}, column ${c + 1}${
                        number ? `, ${number}` : ""
                      }, ${game.cells[key] || "blank"}${
                        error ? ", incorrect" : ""
                      }`}
                      accessibilityState={{ selected: selected === key }}
                      onPress={() => selectCell(key)}
                      style={[
                        s.cell,
                        { width: cellSize, height: cellSize },
                        activeCells.includes(key) && {
                          backgroundColor: colors.highlight,
                        },
                        selected === key &&
                          !done && { backgroundColor: colors.selected },
                        done && { backgroundColor: colors.highlight },
                        error && { backgroundColor: colors.errorSurface },
                      ]}
                    >
                      {number && (
                        <Text
                          allowFontScaling={false}
                          style={[
                            s.number,
                            {
                              fontSize: typography.numberSize,
                              lineHeight: typography.numberLineHeight,
                              left: 1,
                            },
                          ]}
                        >
                          {number}
                        </Text>
                      )}
                      <Text
                        allowFontScaling={false}
                        style={[
                          s.letter,
                          {
                            fontSize: typography.letterSize,
                            lineHeight: typography.letterLineHeight,
                            paddingTop: typography.letterTop,
                          },
                          error && { color: colors.error },
                        ]}
                      >
                        {game.cells[key] || ""}
                      </Text>
                      {error && <View style={s.errorDot} />}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>}
      </View>
      <View style={[s.clueBar, { height: Math.max(44, clueBarHeight) }]}>
        <Button
          quiet
          label="‹"
          accessibilityLabel="Previous clue"
          onPress={() => stepClue(-1)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${caption ? `${caption}. ` : ""}${clueLabel}. ${entry.clue}`}
          accessibilityHint="Show all clues"
          onPress={openClues}
          style={s.currentClue}
        >
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.5}
            accessibilityLiveRegion="polite"
            style={[s.clueLabel, caption && s.clueStatus]}
          >
            {caption ?? clueLabel}
          </Text>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.5} style={s.currentText}>
            {entry.clue}
          </Text>
        </Pressable>
        <Button
          quiet
          label="›"
          accessibilityLabel="Next clue"
          onPress={() => stepClue(1)}
        />
      </View>
      {done ? (
        <View style={s.done}>
          <Button label="Done" onPress={onBack} />
        </View>
      ) : nativeKeyboard ? (
        // The grid owns the text. iOS provides the keyboard and sends key events.
        <TextInput
          ref={input}
          style={s.nativeInput}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          contextMenuHidden
          maxLength={0}
          keyboardAppearance="default"
          returnKeyType="next"
          submitBehavior="submit"
          onKeyPress={({ nativeEvent: { key } }) => {
            if (key === "Enter" || key === "Escape") return;
            playKeyFeedback();
            if (key === "Tab") stepClue(1);
            else if (key === "Backspace") type("⌫");
            else {
              for (const letter of key.match(/[a-z]/gi) ?? []) type(letter.toUpperCase());
            }
          }}
          onSubmitEditing={() => {
            playKeyFeedback();
            stepClue(1);
          }}
        />
      ) : (
        <View style={s.keyboard}>
          {["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM⌫"].map((row, i) => (
            <View
              key={row}
              style={[
                s.keyRow,
                { paddingHorizontal: i === 1 ? 14 : i === 2 ? 28 : 0 },
              ]}
            >
              {[...row].map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key === "⌫" ? "Delete letter" : key}
                  onPress={() => {
                    playKeyFeedback();
                    type(key);
                  }}
                  style={({ pressed }) => [
                    s.key,
                    height < 750 && { height: 44 },
                    pressed && { backgroundColor: colors.selected },
                  ]}
                >
                  <Text allowFontScaling={false} style={s.keyText}>
                    {key}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}
      <Modal
        visible={showClues}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClues(false)}
        onDismiss={() => input.current?.focus()}
      >
        <View style={s.modal}>
          <View style={s.modalTop}>
            <Text style={s.modalTitle}>Clues</Text>
            <Button quiet label="Done" onPress={() => setShowClues(false)} />
          </View>
          <ScrollView>
            {(["across", "down"] as const).map((direction) => (
              <View key={direction}>
                <Text style={s.clueSection}>
                  {direction === "across" ? "Across" : "Down"}
                </Text>
                {p.entries.map((e, i) =>
                  e.direction === direction ? clueLine(e, i) : null
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, width: "100%", maxWidth: 700, alignSelf: "center" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  heading: { flexShrink: 1, fontFamily: fonts.medium, color: colors.ink, fontSize: 15 },
  topActions: { flexDirection: "row", alignItems: "center" },
  playArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
  },
  board: {
    flexDirection: "column",
    backgroundColor: colors.ink,
    borderRadius: 2,
    overflow: "hidden",
  },
  cell: {
    backgroundColor: colors.white,
    borderWidth: 0.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    position: "absolute",
    top: 1,
    left: 3,
    color: colors.ink,
    fontFamily: fonts.medium,
  },
  letter: {
    fontFamily: fonts.medium,
    color: colors.ink,
    paddingTop: 7,
    width: "100%",
    textAlign: "center",
  },
  errorDot: {
    position: "absolute",
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.error,
  },
  clueBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
  currentClue: { flex: 1, justifyContent: "center", paddingHorizontal: 4 },
  clueLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    color: colors.muted,
    marginBottom: 2,
  },
  clueStatus: { color: colors.primary, letterSpacing: 0 },
  currentText: {
    fontFamily: fonts.medium,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  keyboard: {
    paddingHorizontal: 6,
    paddingBottom: 10,
    alignSelf: "center",
    width: "100%",
    maxWidth: 540,
  },
  nativeInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  keyRow: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginBottom: 7,
  },
  key: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontFamily: fonts.medium, fontSize: 19, color: colors.ink },
  done: { padding: 24 },
  modal: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: 24,
    paddingTop: 32,
  },
  modalTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontFamily: fonts.serif, fontSize: 30, color: colors.ink },
  clueSection: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.ink,
    marginTop: 24,
    marginBottom: 12,
  },
  clueRow: {
    flexDirection: "row",
    gap: 16,
    padding: 14,
    minHeight: 52,
    borderRadius: 10,
  },
  clueNumber: {
    width: 24,
    fontFamily: fonts.bold,
    color: colors.ink,
    fontSize: 16,
  },
  clueText: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 25,
  },
  length: { color: colors.muted },
});
