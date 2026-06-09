import {
  getSharedData,
  registerEntityQuery,
  registerIntentHandler,
  removeSharedData,
  setSharedData,
} from 'expo-intents';
import { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native';

const KEY = 'phase2-roundtrip';

type Task = { id: string; title: string; subtitle?: string };

export default function App() {
  const [result, setResult] = useState<string>('(not run yet)');

  // Phase 3: register the handler for the `getGreeting` App Intent (declared in app.json) and
  // seed the shared data it reads. Done once on launch; both persist to the App Group store, so
  // the shortcut works later even with the app closed.
  useEffect(() => {
    setSharedData('user', 'Username');
    registerIntentHandler('getGreeting', async (_params, context) => {
      'intent';
      // Defined inside the handler: it runs in the bare runtime and can't close over outer scope.
      const greetings: Record<string, string> = {
        en: 'Hello',
        uk: 'Привіт',
        es: 'Hola',
        de: 'Hallo',
      };
      const lang = context.locale.split('-')[0];
      const greeting = greetings[lang] ?? greetings.en;
      const user = getSharedData<string>('user') ?? 'world';
      console.log('getGreeting handler ran for', context.intentName);
      return `${greeting}, ${user}!`;
    });

    registerIntentHandler<{ message: string; loud: boolean }>('echo', async (params) => {
      'intent';
      const text = `You said: ${params.message}`;
      return params.loud ? text.toUpperCase() : text;
    });

    registerIntentHandler<{ text: string; priority: string; due: Date | null }>(
      'createReminder',
      async (params) => {
        'intent';
        const when = params.due ? params.due.toLocaleDateString() : 'no due date';
        return `[${params.priority}] ${params.text} (${when})`;
      }
    );

    // Variant 3: entity picker backed by JS. The query functions run in the App Intents runtime
    // (here from a static list; they could just as well `fetch` from a server).
    setSharedData('tasks', [
      { id: '1', title: 'Buy milk', subtitle: 'Groceries' },
      { id: '2', title: 'Call mom', subtitle: 'Family' },
      { id: '3', title: 'Ship release', subtitle: 'Work' },
    ]);
    registerEntityQuery('Task', {
      suggested: async () => {
        'intent';
        return getSharedData<Task[]>('tasks') ?? [];
      },
      find: async (query) => {
        'intent';
        const tasks = getSharedData<Task[]>('tasks') ?? [];
        const q = query.toLowerCase();
        return tasks.filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q) ||
            t.subtitle?.toLowerCase().includes(q)
        );
      },
      get: async (ids) => {
        'intent';
        const tasks = getSharedData<Task[]>('tasks') ?? [];
        return tasks.filter((t) => ids.includes(t.id));
      },
    });

    registerIntentHandler<{ task: { id: string; title: string } }>(
      'completeTask',
      async (params) => {
        'intent';
        return `Completed: ${params.task.title}`;
      }
    );
  }, []);

  const runRoundTrip = () => {
    const payload = { message: 'hello from JS', at: new Date().toISOString() };
    setSharedData(KEY, payload);
    const readBack = getSharedData<typeof payload>(KEY);
    setResult(JSON.stringify(readBack, null, 2));
  };

  const clear = () => {
    removeSharedData(KEY);
    setResult(JSON.stringify(getSharedData(KEY)));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Module API Example</Text>
        <Group name="Phase 2 — Shared data round trip">
          <Button title="Set + get shared data" onPress={runRoundTrip} />
          <Button title="Remove shared data" onPress={clear} />
          <Text style={styles.result}>{result}</Text>
        </Group>
        <Group name="App Intents (trigger from Shortcuts / Siri)">
          <Text style={styles.body}>
            getGreeting — Siri: Get greeting from expo-intents-example. Returns Hello, Username!
          </Text>
          <Text style={styles.body}>
            echo — has Message (text) and Shout (bool) parameters. Returns You said: ... (upper-cased
            when Shout is on).
          </Text>
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  header: { fontSize: 30, margin: 20 },
  groupHeader: { fontSize: 20, marginBottom: 20 },
  group: { margin: 20, backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  container: { flex: 1, backgroundColor: '#eee' },
  body: { fontSize: 15, lineHeight: 22 },
  result: { marginTop: 16, fontFamily: 'Courier', fontSize: 14 },
  view: { flex: 1, height: 200 },
};
