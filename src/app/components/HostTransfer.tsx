'use client';

import { useState } from 'react';
import { acceptHostTransfer, cancelHostTransfer, requestHostTransfer } from '@/lib/client/rooms';
import type { RoomSnapshot } from '@/lib/timer/types';

interface SharedProps {
  roomId: string;
  clientId: string;
  snapshot: RoomSnapshot;
  onUpdate: (snapshot: RoomSnapshot) => void;
}

export function HostTransferBadge({ roomId, clientId, snapshot, token, onUpdate }: SharedProps & { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function request(targetCandidateId: string) {
    setBusy(true);
    setMessage('');
    try {
      onUpdate(await requestHostTransfer(roomId, clientId, targetCandidateId, token));
      setMessage('相手の承認を待っています。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '移譲を依頼できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setMessage('');
    try {
      onUpdate(await cancelHostTransfer(roomId, clientId, token));
      setMessage('移譲依頼を取り消しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '取り消せませんでした。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="host-transfer-wrap">
      <button type="button" className="badge badge-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}>ホスト</button>
      {open && <div className="host-transfer-menu" role="dialog" aria-label="ホストを譲る">
        <strong>ホストを譲る</strong>
        <p>接続中の参加者を選んでください。</p>
        {snapshot.hostTransfer?.direction === 'outgoing' ? (
          <div className="host-transfer-pending"><span>{snapshot.hostTransfer.targetLabel} に依頼中</span><button type="button" disabled={busy} onClick={() => void cancel()}>取り消す</button></div>
        ) : snapshot.participants?.length ? (
          <div className="host-transfer-list">{snapshot.participants.map((participant) => <button type="button" key={participant.candidateId} disabled={busy} onClick={() => void request(participant.candidateId)}>{participant.label}<span>移譲する</span></button>)}</div>
        ) : <p className="host-transfer-empty">移譲できる参加者はいません。</p>}
        {message && <p className="host-transfer-message" role="status">{message}</p>}
      </div>}
    </div>
  );
}

export function HostTransferOffer({ roomId, clientId, snapshot, onUpdate, onToken }: SharedProps & { onToken: (token: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (snapshot.hostTransfer?.direction !== 'incoming') return null;

  async function accept() {
    setBusy(true);
    setMessage('');
    try {
      const result = await acceptHostTransfer(roomId, clientId);
      onToken(result.hostToken);
      onUpdate(result.snapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ホストを引き継げませんでした。');
      setBusy(false);
    }
  }

  return <div className="host-transfer-offer"><div><strong>ホストを引き継ぎますか？</strong><p>承認すると、あなたがタイマーを操作できます。</p></div><button type="button" className="button button-primary" disabled={busy} onClick={() => void accept()}>{busy ? '引き継ぎ中…' : '引き継ぐ'}</button>{message && <p className="error" role="alert">{message}</p>}</div>;
}
