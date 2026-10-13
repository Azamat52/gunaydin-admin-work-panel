/* eslint-disable @typescript-eslint/no-explicit-any */
// Tiny replacement for node-telegram-bot-api that works over webhooks + fetch.
type Handler = (msg: any, match?: RegExpExecArray | null) => Promise<void> | void;

export class MiniBot {
  private textHandlers: { re: RegExp; fn: Handler }[] = [];
  private handlers: Record<string, Handler[]> = {};
  constructor(private token: string) {}

  onText(re: RegExp, fn: Handler) { this.textHandlers.push({ re, fn }); }
  on(event: string, fn: Handler) { (this.handlers[event] ??= []).push(fn); }

  async api(method: string, body: Record<string, unknown>) {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!json.ok) throw new Error(`Telegram ${method} failed [${res.status}]: ${json.description ?? ''}`);
    return json.result;
  }

  /** Downloads a Telegram file by file_id. */
  async downloadFile(file_id: string): Promise<Buffer> {
    const f = await this.api('getFile', { file_id });
    const res = await fetch(`https://api.telegram.org/file/bot${this.token}/${f.file_path}`);
    if (!res.ok) throw new Error(`Telegram file download failed [${res.status}]`);
    return Buffer.from(await res.arrayBuffer());
  }

  sendMessage(chat_id: number, text: string, opts: Record<string, unknown> = {}) {
    return this.api('sendMessage', { chat_id, text, ...opts });
  }
  sendLocation(chat_id: number, latitude: number, longitude: number, opts: Record<string, unknown> = {}) {
    return this.api('sendLocation', { chat_id, latitude, longitude, ...opts });
  }
  /** Sends a photo from an https URL or a data: URI (uploaded as a file). */
  async sendPhoto(chat_id: number, image: string, opts: Record<string, unknown> = {}) {
    if (!image.startsWith('data:')) return this.api('sendPhoto', { chat_id, photo: image, ...opts });
    const m = /^data:([^;]+);base64,(.*)$/s.exec(image);
    if (!m) throw new Error('Invalid image data');
    const form = new FormData();
    form.append('chat_id', String(chat_id));
    form.append('photo', new Blob([Buffer.from(m[2], 'base64')], { type: m[1] }), 'photo.jpg');
    for (const [k, v] of Object.entries(opts)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, { method: 'POST', body: form });
    const json: any = await res.json().catch(() => ({}));
    if (!json.ok) throw new Error(`Telegram sendPhoto failed [${res.status}]: ${json.description ?? ''}`);
    return json.result;
  }
  editMessageText(text: string, opts: Record<string, unknown> = {}) {
    return this.api('editMessageText', { text, ...opts }).catch(async (e) => {
      const err = String(e);
      if (err.includes('message is not modified')) return;
      // Broken HTML/Markdown in text: retry without parse_mode.
      if (err.includes("can't parse entities")) {
        const { parse_mode, ...rest } = opts as any;
        if (parse_mode) return this.editMessageText(text, rest);
      }
      // Photo messages can't become text: replace the message instead.
      if (err.includes('no text in the message') && opts.chat_id) {
        const { chat_id, message_id, ...rest } = opts as any;
        await this.deleteMessage(chat_id, message_id).catch(() => {});
        return this.sendMessage(chat_id, text, rest).catch((x) => console.error(x));
      }
      console.error(e);
    });
  }
  editMessageCaption(caption: string, opts: Record<string, unknown> = {}) {
    return this.api('editMessageCaption', { caption, ...opts }).catch((e) => {
      if (!String(e).includes('message is not modified')) console.error(e);
    });
  }
  deleteMessage(chat_id: number, message_id: number) {
    return this.api('deleteMessage', { chat_id, message_id });
  }
  answerCallbackQuery(callback_query_id: string, opts: Record<string, unknown> = {}) {
    if (!callback_query_id) return Promise.resolve();
    return this.api('answerCallbackQuery', { callback_query_id, ...opts }).catch(() => {});
  }

  async processUpdate(update: any) {
    const run = async (fns: Handler[] | undefined, arg: any) => {
      for (const fn of fns ?? []) {
        try { await fn(arg); } catch (e) { console.error('Handler error:', e); }
      }
    };
    if (update.message) {
      const msg = update.message;
      if (msg.text) {
        for (const { re, fn } of this.textHandlers) {
          const m = re.exec(msg.text);
          if (m) { try { await fn(msg, m); } catch (e) { console.error('Handler error:', e); } }
        }
      }
      await run(this.handlers['message'], msg);
      if (msg.contact) await run(this.handlers['contact'], msg);
    }
    if (update.callback_query) await run(this.handlers['callback_query'], update.callback_query);
  }
}
