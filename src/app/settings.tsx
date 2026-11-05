import React from 'react';
import { Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useClub } from '@/store/useClub';
import { Btn, Card, Chip, Field, Row, Screen, SectionTitle, Segmented, Stepper, Txt, confirmAction, notify } from '@/ui/kit';
import { DEFAULT_CLUB, type Format } from '@/domain/types';

export default function Settings() {
  const router = useRouter();
  const club = useClub((s) => s.club) ?? DEFAULT_CLUB;
  const updateClub = useClub((s) => s.updateClub);
  const exportData = useClub((s) => s.exportData);
  const importData = useClub((s) => s.importData);
  const loadDemo = useClub((s) => s.loadDemo);
  const resetAll = useClub((s) => s.resetAll);

  const [name, setName] = React.useState(club.name);
  const [currency, setCurrency] = React.useState(club.currency);
  const [budget, setBudget] = React.useState(String(club.annualWageBudget));
  const [exported, setExported] = React.useState<string | null>(null);
  const [importText, setImportText] = React.useState('');
  const [importMsg, setImportMsg] = React.useState<string | null>(null);

  const budgetOk = /^\d+(\.\d+)?$/.test(budget);

  return (
    <Screen>
      <Card>
        <Field label="Club name" value={name} onChangeText={(v) => { setName(v); if (v.trim()) updateClub({ name: v.trim() }); }} autoCapitalize="words" />
        <Row align="flex-start">
          <Field label="Currency" value={currency} onChangeText={(v) => { setCurrency(v); if (v.trim()) updateClub({ currency: v.trim() }); }} maxLength={3} />
          <Field
            label="Annual wage budget"
            value={budget}
            onChangeText={(v) => { setBudget(v); if (/^\d+(\.\d+)?$/.test(v)) updateClub({ annualWageBudget: Number(v) }); }}
            keyboardType="decimal-pad"
            error={budgetOk ? undefined : 'Enter a number'}
          />
        </Row>
      </Card>

      <Card>
        <Txt v="h3">Matches</Txt>
        <Txt v="label">Default format</Txt>
        <Segmented<Format> value={club.defaultFormat} onChange={(v) => updateClub({ defaultFormat: v })} options={[{ value: 7, label: '7-a-side' }, { value: 9, label: '9-a-side' }, { value: 11, label: '11-a-side' }]} />
        <Stepper label="Match length (min)" value={club.matchMinutes} onChange={(v) => updateClub({ matchMinutes: v })} min={20} max={120} step={5} format={(n) => String(n)} />
        <Stepper label="Rotation windows" value={club.periods} onChange={(v) => updateClub({ periods: v })} min={2} max={9} step={1} format={(n) => String(n)} />
      </Card>

      <Card>
        <Txt v="h3">Fair-play policy</Txt>
        <Stepper label="Minimum minutes (%)" value={club.minMinutesPct} onChange={(v) => updateClub({ minMinutesPct: v })} min={0} max={80} step={5} format={(n) => `${n}%`} />
        <Txt v="small" dim>Every available player is guaranteed this share of match time when plans are generated, and anyone below it shows up as a fairness alert.</Txt>
        <Txt v="label">Default approach</Txt>
        <Row gap={6} wrap>
          {[
            { v: 0.15, l: 'Develop' },
            { v: 0.5, l: 'Balanced' },
            { v: 0.85, l: 'Compete' },
          ].map((o) => (
            <Chip key={o.l} label={o.l} selected={Math.abs(club.balance - o.v) < 0.2} onPress={() => updateClub({ balance: o.v })} />
          ))}
        </Row>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <Txt v="small" dim>Your data lives on this device. Export a backup to move it to another device or the web app.</Txt>
        <Row wrap>
          <Btn
            label="Export backup"
            icon="download-outline"
            kind="secondary"
            onPress={async () => {
              const json = exportData();
              setExported(json);
              if (Platform.OS !== 'web') {
                try {
                  await Share.share({ message: json, title: 'Gaffer backup' });
                } catch {
                  /* cancelled */
                }
              }
            }}
          />
        </Row>
        {exported ? <Field label="Backup (select all & copy)" value={exported} onChangeText={() => {}} multiline editable={Platform.OS === 'web'} /> : null}
        <Field label="Restore from backup" value={importText} onChangeText={setImportText} multiline placeholder="Paste a Gaffer backup here" autoCorrect={false} />
        <Btn
          label="Restore"
          icon="push-outline"
          kind="secondary"
          disabled={!importText.trim()}
          onPress={() =>
            confirmAction('Replace current data?', 'Restoring overwrites everything currently in the app.', () => {
              const r = importData(importText);
              setImportMsg(r.ok ? 'Restored.' : (r.error ?? 'Failed'));
              if (r.ok) setImportText('');
            })
          }
        />
        {importMsg ? <Txt v="small">{importMsg}</Txt> : null}
      </Card>

      <Card>
        <Btn
          label="Load demo club"
          icon="sparkles"
          kind="secondary"
          onPress={() =>
            confirmAction('Load demo data?', 'This replaces your current club with sample data.', () => {
              loadDemo();
              router.dismissAll();
            })
          }
        />
        <Btn
          label="Erase everything"
          icon="trash"
          kind="danger"
          onPress={() =>
            confirmAction('Erase all data?', 'Your club, players, fixtures and history will be deleted from this device.', () => {
              resetAll();
              notify('All data erased.');
            })
          }
        />
      </Card>
      <Btn label="Done" onPress={() => router.back()} />
    </Screen>
  );
}
