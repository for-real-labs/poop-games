import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  AppState,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { Lora_500Medium } from "@expo-google-fonts/lora";
import * as Haptics from "expo-haptics";
import { State, openGame, updateCell } from "./src/game";
import { readTactileFeedback, repository, saveTactileFeedback } from "./src/storage";
import { Home } from "./src/components/Home";
import { PuzzleScreen } from "./src/components/PuzzleScreen";
import { Button } from "./src/components/Button";
import { colors, fonts } from "./src/theme";
import { Dashboard, Screen } from "./src/components/Dashboard";
import { WordGuess } from "./src/components/WordGuess";
import { GalacticRaiders } from "./src/components/GalacticRaiders";
import { useStudio } from "./src/studio/useStudio";
import { GameStudio } from "./src/components/GameStudio";
export default function App() {
  const studio = useStudio();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [tactileFeedback, setTactileFeedback] = useState<boolean | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void readTactileFeedback()
      .catch(() => true)
      .then((enabled) => {
        if (active) setTactileFeedback(enabled);
      });
    return () => {
      active = false;
    };
  }, []);
  async function changeTactileFeedback(enabled: boolean) {
    setSavingSettings(true);
    try {
      await saveTactileFeedback(enabled);
      setTactileFeedback(enabled);
      setSettingsError(null);
    } catch {
      setSettingsError("Couldn’t save this setting. Try again.");
    } finally {
      setSavingSettings(false);
    }
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "dashboard") return false;
      setSelected(null);
      setScreen("dashboard");
      return true;
    });
    return () => sub.remove();
  }, [screen]);
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Lora_500Medium,
  });
  const [state, setState] = useState<State | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [now, setNow] = useState(new Date()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await repository.load());
    } catch {
      setError("Couldn’t open your puzzles.");
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => setNow(new Date()), 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [load]);
  const save = (next: State) => {
    setState(next);
    void repository
      .save(next)
      .then(() => setError(null))
      .catch(() => setError("Couldn’t save. Tap Retry."));
  };
  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const previous = repository.state.next;
      const next = await repository.start(new Date());
      setState(next);
      setNow(new Date());
      if (next.next > previous) setSelected(next.games[0].puzzleId);
    } catch {
      setError("Couldn’t save. Tap Retry.");
      setState(repository.state);
    } finally {
      setBusy(false);
    }
  }
  function changeCell(key: string, value: string) {
    if (selected === null) return;
    const next = updateCell(repository.state, selected, key, value);
    const game = next.games.find((g) => g.puzzleId === selected);
    const before = repository.state.games.find((g) => g.puzzleId === selected);
    save(next);
    if (tactileFeedback !== false && game?.completedAt && !before?.completedAt)
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    return game;
  }
  const game = state?.games.find((g) => g.puzzleId === selected);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <StatusBar style="dark" />
        {(!fontsLoaded && !fontError) || (!state && !error) ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={s.content}
            behavior={Platform.OS === "ios" && screen === "crossword" ? "padding" : undefined}
          >
            {screen !== "dashboard" && !(screen === "crossword" && game) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to games"
                onPress={() => {
                  setSelected(null);
                  setScreen("dashboard");
                }}
                style={{ paddingHorizontal: 24, paddingVertical: 12 }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    color: colors.ink,
                    fontSize: 14,
                  }}
                >
                  ‹ Games
                </Text>
              </Pressable>
            )}
            {screen === "dashboard" && (
              <Dashboard
                onOpen={(next) => {
                  setCreatedId(null);
                  setScreen(next);
                }}
                savedGames={studio.games.filter((g) => g.saved)}
                onPlay={(id) => {
                  setCreatedId(id);
                  setScreen("studio");
                }}
              />
            )}
            {screen === "studio" && (
              <GameStudio
                studio={studio}
                initialId={createdId}
                onSaved={() => setScreen("dashboard")}
              />
            )}
            {screen === "word" && <WordGuess />}
            {screen === "raiders" && <GalacticRaiders />}
            {screen === "settings" && (
              <View style={s.settings}>
                <Text accessibilityRole="header" style={s.settingsTitle}>Settings</Text>
                <View style={s.settingRow}>
                  <Text style={s.settingLabel}>Crossword tactile feedback</Text>
                  <Switch
                    accessibilityLabel="Crossword tactile feedback"
                    value={tactileFeedback !== false}
                    disabled={tactileFeedback === null || savingSettings}
                    onValueChange={(enabled) => void changeTactileFeedback(enabled)}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
                {settingsError && (
                  <Text accessibilityRole="alert" style={s.settingError}>{settingsError}</Text>
                )}
              </View>
            )}
            {screen === "crossword" && error && (
              <View accessibilityRole="alert" style={s.error}>
                <Text style={s.errorText}>{error}</Text>
                <Button
                  quiet
                  label="Retry"
                  onPress={() => {
                    if (!repository.ready) void load();
                    else save(repository.state);
                  }}
                />
              </View>
            )}
            {screen === "crossword" &&
              state &&
              (game ? (
                <PuzzleScreen
                  key={game.puzzleId}
                  game={game}
                  tactileFeedback={tactileFeedback !== false}
                  onCell={changeCell}
                  onBack={() => setSelected(null)}
                />
              ) : (
                <Home
                  state={state}
                  now={now}
                  busy={busy}
                  onStart={() => void start()}
                  onOpen={(id) => {
                    save(openGame(repository.state, id));
                    setSelected(id);
                  }}
                  onError={() => setError("Couldn’t open the link.")}
                />
              ))}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1 },
  settings: { width: "100%", maxWidth: 660, alignSelf: "center", padding: 24 },
  settingsTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 34 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 24 },
  settingLabel: { flex: 1, fontFamily: fonts.medium, color: colors.ink, fontSize: 17 },
  settingError: { marginTop: 12, fontFamily: fonts.body, color: colors.error, fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.errorSurface,
  },
  errorText: {
    fontFamily: fonts.body,
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
});
