/** A local IME staging buffer, never a mirror of the remote editor. Native
 * target capabilities and the website's final editing result stay remote. */
export class RemoteBrowserIme {
  private transaction: { id: string; live: boolean; begun: boolean; sending: boolean; terminal: boolean;
    pending: { type: 'compose' | 'commit' | 'cancel'; text: string } | null } | null = null;
  composing = false;
  constructor(private readonly receiver: HTMLTextAreaElement,
    private readonly call: (input: { id: string; type: string; text?: string }) => Promise<unknown>,
    private readonly current: () => boolean, private readonly error: (message: string) => void) {}
  start() {
    // A completed local composition has already queued its terminal command.
    // Starting the next character must not cancel it while the reply is in flight.
    if (this.transaction?.terminal) this.transaction = null;
    this.retire(false); this.composing = true;
    const t: NonNullable<RemoteBrowserIme['transaction']> = this.transaction = { id: crypto.randomUUID(), live: true, begun: false, sending: true, terminal: false,
      pending: null as { type: 'compose' | 'commit' | 'cancel'; text: string } | null };
    void this.call({ id: t.id, type: 'begin' }).then(() => {
      t.begun = true; t.sending = false;
      if (!t.live || !this.current()) { void this.call({ id: t.id, type: 'cancel' }).catch(() => {}); return; }
      this.pump(t);
    }).catch(error => this.failed(t, error));
  }
  update(text: string) { if (text && this.composing && this.transaction) { const t = this.transaction; t.pending = { type: 'compose', text }; setTimeout(() => this.pump(t), 0); } }
  end(text: string) {
    const t = this.transaction; this.composing = false; this.receiver.value = '';
    if (!t || t.terminal) return;
    t.terminal = true; t.pending = null;
    // The worker serializes this page's commands. Queue commit immediately
    // behind begin/in-flight preedit, before a following composition's begin.
    void this.call({ id: t.id, type: text ? 'commit' : 'cancel', text }).then(() => {
      t.live = false; if (this.transaction === t) this.transaction = null;
    }).catch(error => this.failed(t, error));
  }
  commit(text: string) { if (text) { this.start(); this.end(text); } }
  retire(clear = true) {
    const t = this.transaction; this.transaction = null; this.composing = false; if (clear) this.receiver.value = '';
    if (!t) return;
    t.live = false; t.pending = null;
    // Begin/compose may still be in flight. Its completion also cancels only
    // this id; a late cancel can never retire a newer input transaction.
    void this.call({ id: t.id, type: 'cancel' }).catch(() => {});
  }
  private pump(t: NonNullable<RemoteBrowserIme['transaction']>) {
    if (t.terminal || !t.live || !this.current() || !t.begun || t.sending || !t.pending) return;
    const next = t.pending; t.pending = null; t.sending = true;
    if (next.text.length > 16384) { this.failed(t, new Error('Input text is too long')); return; }
    void this.call({ id: t.id, ...next }).then(() => {
      t.sending = false;
      if (!t.live || !this.current()) { void this.call({ id: t.id, type: 'cancel' }).catch(() => {}); return; }
      if (next.type !== 'compose') { t.live = false; if (this.transaction === t) this.transaction = null; }
      else this.pump(t);
    }).catch(error => this.failed(t, error));
  }
  private failed(t: NonNullable<RemoteBrowserIme['transaction']>, error: Error) {
    const report = t.live && this.current(); t.live = false;
    if (this.transaction === t) { this.transaction = null; this.composing = false; this.receiver.value = ''; }
    void this.call({ id: t.id, type: 'cancel' }).catch(() => {});
    if (report) this.error(error.message);
  }
}
