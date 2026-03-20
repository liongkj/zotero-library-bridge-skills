import { config } from "../../package.json";

type AnyObject = Record<string, any>;
type BridgeStatus = "ok" | "partial" | "error";

type BridgeResult = {
  item_id?: string;
  status: "ok" | "skipped" | "error";
  details: string;
  data?: AnyObject;
};

type BridgeResponse = {
  action: string;
  status: BridgeStatus;
  summary: string;
  results: BridgeResult[];
  errors: string[];
};

type ParsedRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
};

const PREF_BRIDGE_PORT = `${config.addonRef}.bridge.port`;

export default class ZoteroLibraryBridge {
  private serverSocket: any = null;
  private running = false;
  private port = 23130;

  private log(message: string, error?: unknown): void {
    if (error) {
      Zotero.debug(`[${config.addonRef}] ${message}: ${String(error)}`);
    } else {
      Zotero.debug(`[${config.addonRef}] ${message}`);
    }
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.port = this.getPortFromPrefs();

    const startResult = this.tryStartServer(this.port) || this.tryStartServer(0);

    if (!startResult) {
      throw new Error("Unable to start local bridge server");
    }

    this.serverSocket = startResult;
    this.port = Number(this.serverSocket.port || this.port);

    addon.api.libraryBridge = {
      execute: async (action: string, payload: AnyObject) => {
        return this.executeAction(action, payload || {});
      },
      info: () => ({
        host: "127.0.0.1",
        port: this.port,
        requires_token: false,
      }),
    };

    this.running = true;
    this.log(`libraryBridge listening on 127.0.0.1:${this.port}`);
  }

  private tryStartServer(port: number): any | null {
    try {
      const candidate = Components.classes[
        "@mozilla.org/network/server-socket;1"
      ].createInstance(Components.interfaces.nsIServerSocket);
      candidate.init(port, true, 50);
      candidate.asyncListen({
        onSocketAccepted: (_server: any, transport: any) => {
          this.handleTransport(transport);
        },
        onStopListening: (_server: any, status: any) => {
          this.log(`libraryBridge server stopped (${String(status)})`);
        },
      });
      return candidate;
    } catch (error) {
      this.log(`libraryBridge start failed on port ${port}`, error);
      return null;
    }
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    if (this.serverSocket) {
      try {
        this.serverSocket.close();
      } catch (error) {
        this.log("libraryBridge close error", error);
      }
      this.serverSocket = null;
    }

    delete addon.api.libraryBridge;
    this.running = false;
  }

  private getPortFromPrefs(): number {
    const rawPort = Number(Zotero.Prefs.get(PREF_BRIDGE_PORT) || 23130);
    if (Number.isFinite(rawPort) && rawPort >= 1024 && rawPort <= 65535) {
      return rawPort;
    }
    Zotero.Prefs.set(PREF_BRIDGE_PORT, 23130);
    return 23130;
  }

  private handleTransport(transport: any): void {
    const input = transport.openInputStream(0, 0, 0);
    const output = transport.openOutputStream(0, 0, 0);

    const scriptableInput = Components.classes[
      "@mozilla.org/scriptableinputstream;1"
    ].createInstance(Components.interfaces.nsIScriptableInputStream);
    scriptableInput.init(input);

    void (async () => {
      try {
        const raw = await this.readRawRequest(input, scriptableInput);

        try {
          scriptableInput.close();
        } catch (_error) {
          // no-op
        }

        try {
          input.close();
        } catch (_error) {
          // no-op
        }

        await this.processRawRequest(raw, output, transport);
      } catch (error) {
        this.log("transport processing failed", error);
        try {
          this.writeJson(output, 500, {
            action: "internal",
            status: "error",
            summary: "Transport processing failed",
            results: [],
            errors: [String((error as any)?.message || error)],
          });
        } catch (_innerError) {
          // no-op
        }
        this.closeTransport(output, transport);
      }
    })();
  }

  private async readRawRequest(input: any, scriptableInput: any): Promise<string> {
    const deadline = Date.now() + 5000;
    let raw = "";

    while (Date.now() < deadline) {
      let available = 0;
      try {
        available = input.available();
      } catch (_error) {
        available = 0;
      }

      if (available > 0) {
        raw += scriptableInput.read(available);
      }

      if (this.isRequestComplete(raw)) {
        break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }

    return raw;
  }

  private isRequestComplete(raw: string): boolean {
    const separator = "\r\n\r\n";
    const headerEnd = raw.indexOf(separator);
    if (headerEnd < 0) {
      return false;
    }

    const head = raw.slice(0, headerEnd);
    const body = raw.slice(headerEnd + separator.length);
    const contentLengthMatch = head.match(/(?:^|\r\n)content-length:\s*(\d+)/i);

    if (!contentLengthMatch) {
      return true;
    }

    const contentLength = Number(contentLengthMatch[1]);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      return true;
    }

    return body.length >= contentLength;
  }

  private async processRawRequest(
    raw: string,
    output: any,
    transport: any,
  ): Promise<void> {
    const request = this.parseHttpRequest(raw);
    if (!request) {
      this.writeJson(output, 400, {
        error: "Invalid HTTP request",
      });
      this.closeTransport(output, transport);
      return;
    }

    if (request.method === "OPTIONS") {
      this.writeJson(output, 204, {});
      this.closeTransport(output, transport);
      return;
    }

    try {
      const response = await this.routeRequest(request);
      this.writeJson(output, this.statusCodeFromResponse(response), response);
    } catch (error: any) {
      this.writeJson(output, 500, {
        action: "internal",
        status: "error",
        summary: "Unhandled server error",
        results: [],
        errors: [String(error?.message || error)],
      });
    }

    this.closeTransport(output, transport);
  }

  private closeTransport(output: any, transport: any): void {
    try {
      output.close();
    } catch (_error) {
      // no-op
    }
  }

  private parseHttpRequest(raw: string): ParsedRequest | null {
    const separator = "\r\n\r\n";
    const headerEnd = raw.indexOf(separator);
    if (headerEnd < 0) {
      return null;
    }

    const head = raw.slice(0, headerEnd);
    const body = raw.slice(headerEnd + separator.length);
    const lines = head.split("\r\n");
    if (!lines.length) {
      return null;
    }

    const requestLine = lines[0].split(" ");
    if (requestLine.length < 2) {
      return null;
    }

    const method = requestLine[0].trim().toUpperCase();
    const path = requestLine[1].trim();

    const headers: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      const colon = line.indexOf(":");
      if (colon <= 0) {
        continue;
      }
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      headers[key] = value;
    }

    return { method, path, headers, body };
  }

  private async routeRequest(request: ParsedRequest): Promise<BridgeResponse> {
    return this.executeHttpRoute(request.method, request.path, request.body);
  }

  private async executeAction(
    action: string,
    payload: AnyObject,
  ): Promise<BridgeResponse> {
    switch (action) {
      case "import_items":
        return this.handleImportItems(payload);
      case "find_full_text":
        return this.handleFindFullText(payload);
      case "get_items":
        return this.handleGetItems(payload);
      case "get_attachments":
        return this.handleGetAttachments(payload);
      case "get_attachment_text":
        return this.handleGetAttachmentText(payload);
      case "add_tags":
        return this.handleAddTags(payload);
      case "move_to_collection":
        return this.handleMoveToCollection(payload);
      case "create_note":
        return this.handleCreateNote(payload);
      case "format_citation":
        return this.handleFormatCitation(payload);
      case "format_bibliography":
        return this.handleFormatBibliography(payload);
      default:
        return {
          action,
          status: "error",
          summary: "Unsupported action",
          results: [],
          errors: [`Unknown action: ${action}`],
        };
    }
  }

  private async executeHttpRoute(
    method: string,
    path: string,
    rawBody: string,
  ): Promise<BridgeResponse> {
    const url = new URL(`http://127.0.0.1${path}`);
    const body = this.parseBody(rawBody);

    if (method === "GET" && url.pathname === "/v1/health") {
      return {
        action: "health",
        status: "ok",
        summary: "Bridge is healthy",
        results: [
          {
            status: "ok",
            details: "Server running",
            data: {
              host: "127.0.0.1",
              port: this.port,
              addon: config.addonName,
            },
          },
        ],
        errors: [],
      };
    }

    if (method === "GET" && url.pathname === "/v1/capabilities") {
      return {
        action: "capabilities",
        status: "ok",
        summary: "Bridge capabilities",
        results: [
          {
            status: "ok",
            details: "Supported actions and workflow defaults",
            data: {
              host: "127.0.0.1",
              port: this.port,
              requires_token: false,
              actions: [
                "import_items",
                "find_full_text",
                "get_items",
                "get_attachments",
                "get_attachment_text",
                "add_tags",
                "move_to_collection",
                "create_note",
                "format_citation",
                "format_bibliography",
              ],
              defaults: {
                import_items: {
                  fetch_full_text: false,
                },
                summarization: {
                  supported: false,
                  note: "Use the zotero-reading-classifier skill after import and full-text retrieval",
                },
              },
              routes: {
                health: "GET /v1/health",
                capabilities: "GET /v1/capabilities",
                import_items: "POST /v1/import-items",
                find_full_text: "POST /v1/find-full-text",
                get_items: "GET /v1/items?q=<query>&limit=<n>",
              },
            },
          },
        ],
        errors: [],
      };
    }

    if (method === "POST" && url.pathname === "/v1/import-items") {
      return this.handleImportItems(body);
    }

    if (method === "POST" && url.pathname === "/v1/find-full-text") {
      return this.handleFindFullText(body);
    }

    if (method === "GET" && url.pathname === "/v1/items") {
      return this.handleGetItems({
        query: url.searchParams.get("q") || "",
        limit: Number(url.searchParams.get("limit") || 20),
      });
    }

    const itemAttachmentsMatch = url.pathname.match(/^\/v1\/items\/([^/]+)\/attachments$/);
    if (method === "GET" && itemAttachmentsMatch) {
      return this.handleGetAttachments({
        item_id: decodeURIComponent(itemAttachmentsMatch[1]),
      });
    }

    const attachmentTextMatch = url.pathname.match(
      /^\/v1\/attachments\/([^/]+)\/text$/,
    );
    if (method === "GET" && attachmentTextMatch) {
      return this.handleGetAttachmentText({
        attachment_id: decodeURIComponent(attachmentTextMatch[1]),
      });
    }

    const itemTagsMatch = url.pathname.match(/^\/v1\/items\/([^/]+)\/tags$/);
    if (method === "POST" && itemTagsMatch) {
      return this.handleAddTags({
        item_id: decodeURIComponent(itemTagsMatch[1]),
        tags: body.tags || [],
      });
    }

    const itemMoveCollectionMatch = url.pathname.match(
      /^\/v1\/items\/([^/]+)\/move-collection$/,
    );
    if (method === "POST" && itemMoveCollectionMatch) {
      return this.handleMoveToCollection({
        item_id: decodeURIComponent(itemMoveCollectionMatch[1]),
        collection_path: body.collection_path,
      });
    }

    const itemNoteMatch = url.pathname.match(/^\/v1\/items\/([^/]+)\/notes$/);
    if (method === "POST" && itemNoteMatch) {
      return this.handleCreateNote({
        item_id: decodeURIComponent(itemNoteMatch[1]),
        note_text: body.note_text,
      });
    }

    if (method === "POST" && url.pathname === "/v1/format/citation") {
      return this.handleFormatCitation(body);
    }

    if (method === "POST" && url.pathname === "/v1/format/bibliography") {
      return this.handleFormatBibliography(body);
    }

    return {
      action: "route",
      status: "error",
      summary: "Route not found",
      results: [],
      errors: [`No route for ${method} ${url.pathname}`],
    };
  }

  private parseBody(rawBody: string): AnyObject {
    if (!rawBody || !rawBody.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      return {};
    } catch (_error) {
      return {};
    }
  }

  private statusCodeFromResponse(response: BridgeResponse): number {
    if (response.status === "ok") {
      return 200;
    }
    if (response.status === "partial") {
      return 207;
    }
    return 400;
  }

  private writeJson(output: any, statusCode: number, body: AnyObject): void {
    const payload = JSON.stringify(body);
    const responseText = [
      `HTTP/1.1 ${statusCode} ${this.statusText(statusCode)}`,
      "Content-Type: application/json; charset=utf-8",
      `Content-Length: ${payload.length}`,
      "Connection: close",
      "",
      payload,
    ].join("\r\n");

    const converter = Components.classes[
      "@mozilla.org/intl/converter-output-stream;1"
    ].createInstance(Components.interfaces.nsIConverterOutputStream);
    converter.init(output, "UTF-8", 0, 0);
    converter.writeString(responseText);
    converter.close();
  }

  private statusText(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return "OK";
      case 204:
        return "No Content";
      case 207:
        return "Multi-Status";
      case 400:
        return "Bad Request";
      case 401:
        return "Unauthorized";
      case 500:
        return "Internal Server Error";
      default:
        return "OK";
    }
  }

  private getLibraryID(): number {
    return Number(Zotero.Libraries.userLibraryID);
  }

  private getItemByKey(itemKey: string): any | null {
    if (!itemKey) {
      return null;
    }

    const libraryID = this.getLibraryID();
    if (typeof Zotero.Items.getByLibraryAndKey !== "function") {
      return null;
    }

    return Zotero.Items.getByLibraryAndKey(libraryID, itemKey) || null;
  }

  private normalizeStatus(results: BridgeResult[], errors: string[]): BridgeStatus {
    if (errors.length > 0 && results.length === 0) {
      return "error";
    }

    const hasErrorResult = results.some((result) => result.status === "error");
    const hasSuccessResult = results.some((result) => result.status === "ok");

    if (errors.length > 0 || (hasErrorResult && hasSuccessResult)) {
      return "partial";
    }

    if (hasErrorResult && !hasSuccessResult) {
      return "error";
    }

    return "ok";
  }

  private authorToCreator(author: string): AnyObject {
    const normalized = String(author || "").trim();
    if (!normalized) {
      return {
        creatorType: "author",
        name: "Unknown",
      };
    }

    if (normalized.includes(",")) {
      const [lastName, firstName] = normalized.split(",", 2).map((part) => part.trim());
      return {
        creatorType: "author",
        firstName: firstName || "",
        lastName: lastName || normalized,
      };
    }

    const parts = normalized.split(/\s+/g);
    if (parts.length === 1) {
      return {
        creatorType: "author",
        lastName: normalized,
      };
    }

    return {
      creatorType: "author",
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  }

  private async handleImportItems(payload: AnyObject): Promise<BridgeResponse> {
    const records = Array.isArray(payload.records)
      ? payload.records
      : Array.isArray(payload.items)
        ? payload.items
        : [];
    const shouldFetchFullText = Boolean(
      payload.fetch_full_text ?? payload.find_full_text ?? false,
    );

    if (!records.length) {
      return {
        action: "import_items",
        status: "error",
        summary: "No records provided",
        results: [],
        errors: ["Expected records array"],
      };
    }

    const results: BridgeResult[] = [];
    const errors: string[] = [];
    const importedItemIDs: string[] = [];

    for (const record of records) {
      try {
        const itemType = String(record.itemType || "journalArticle");
        const item = new Zotero.Item(itemType as any);
        (item as AnyObject).libraryID = this.getLibraryID();

        item.setField("title", String(record.title || "Untitled"));
        item.setField("publicationTitle", String(record.journal || ""));
        item.setField("date", String(record.year || record.date || ""));
        item.setField("DOI", String(record.doi || ""));
        item.setField("url", String(record.url || ""));
        item.setField("abstractNote", String(record.abstract || ""));

        if (Array.isArray(record.authors) && record.authors.length > 0) {
          item.setCreators(record.authors.map((author: string) => this.authorToCreator(author)));
        }

        if (Array.isArray(record.keywords)) {
          for (const keyword of record.keywords) {
            if (keyword) {
              item.addTag(String(keyword));
            }
          }
        }

        await item.saveTx();
        const itemID = item.key || String(item.id || "");
        importedItemIDs.push(itemID);

        results.push({
          item_id: itemID,
          status: "ok",
          details: `Imported ${item.getField("title") || "item"}`,
          data: {
            fetch_full_text_requested: shouldFetchFullText,
          },
        });
      } catch (error: any) {
        const title = String(record?.title || "unknown");
        const message = `Failed to import ${title}: ${String(error?.message || error)}`;
        errors.push(message);
        results.push({
          status: "error",
          details: message,
        });
      }
    }

    let fullTextSummary = "";
    if (shouldFetchFullText && importedItemIDs.length > 0) {
      const fullTextResponse = await this.handleFindFullText({
        item_ids: importedItemIDs,
      });
      for (const result of fullTextResponse.results) {
        results.push({
          ...result,
          details: `[full-text] ${result.details}`,
        });
      }
      errors.push(...fullTextResponse.errors);
      fullTextSummary = `; full-text retrieval processed for ${importedItemIDs.length} imported item(s)`;
    }

    return {
      action: "import_items",
      status: this.normalizeStatus(results, errors),
      summary: `Imported ${importedItemIDs.length}/${records.length} records${fullTextSummary}`,
      results,
      errors,
    };
  }

  private async handleGetItems(payload: AnyObject): Promise<BridgeResponse> {
    const query = String(payload.query || payload.q || "").trim();
    const limit = Math.min(Math.max(Number(payload.limit || 20), 1), 200);
    const results: BridgeResult[] = [];

    if (!query) {
      return {
        action: "get_items",
        status: "error",
        summary: "Query is required",
        results: [],
        errors: ["Use query or q"],
      };
    }

    const search = new Zotero.Search();
    (search as AnyObject).libraryID = this.getLibraryID();
    search.addCondition("quicksearch-titleCreatorYear", "contains", query);

    const ids = (await (search as AnyObject).search()) as number[];
    const sliced = ids.slice(0, limit);

    for (const itemID of sliced) {
      const item = await Zotero.Items.getAsync(itemID);
      if (!item || (typeof item.isRegularItem === "function" && !item.isRegularItem())) {
        continue;
      }

      results.push({
        item_id: item.key,
        status: "ok",
        details: item.getField("title") || "Untitled",
        data: {
          key: item.key,
          title: item.getField("title") || "",
          itemType: item.itemType,
          date: item.getField("date") || "",
          doi: item.getField("DOI") || "",
          url: item.getField("url") || "",
          tags: (item.getTags?.() || []).map((tag: AnyObject) => tag.tag),
          collections: item.getCollections?.() || [],
        },
      });
    }

    return {
      action: "get_items",
      status: "ok",
      summary: `Found ${results.length} items for query '${query}'`,
      results,
      errors: [],
    };
  }

  private async handleGetAttachments(payload: AnyObject): Promise<BridgeResponse> {
    const itemKey = String(payload.item_id || payload.itemKey || "").trim();
    if (!itemKey) {
      return {
        action: "get_attachments",
        status: "error",
        summary: "Item key is required",
        results: [],
        errors: ["Provide item_id"],
      };
    }

    const item = this.getItemByKey(itemKey);
    if (!item) {
      return {
        action: "get_attachments",
        status: "error",
        summary: `Item ${itemKey} not found`,
        results: [],
        errors: ["Unknown item key"],
      };
    }

    const attachmentIDs: number[] = item.getAttachments ? item.getAttachments() : [];
    const results: BridgeResult[] = [];

    for (const attachmentID of attachmentIDs) {
      const attachment = await Zotero.Items.getAsync(attachmentID);
      if (!attachment) {
        continue;
      }

      const filePath =
        typeof attachment.getFilePathAsync === "function"
          ? await attachment.getFilePathAsync()
          : null;

      results.push({
        item_id: attachment.key,
        status: "ok",
        details: attachment.getField("title") || "Attachment",
        data: {
          key: attachment.key,
          title: attachment.getField("title") || "",
          content_type: attachment.attachmentContentType || null,
          filename: attachment.attachmentFilename || null,
          path: filePath || null,
        },
      });
    }

    return {
      action: "get_attachments",
      status: "ok",
      summary: `Found ${results.length} attachments for item ${itemKey}`,
      results,
      errors: [],
    };
  }

  private async handleGetAttachmentText(payload: AnyObject): Promise<BridgeResponse> {
    const attachmentKey = String(payload.attachment_id || payload.attachmentKey || "").trim();
    if (!attachmentKey) {
      return {
        action: "get_attachment_text",
        status: "error",
        summary: "Attachment key is required",
        results: [],
        errors: ["Provide attachment_id"],
      };
    }

    const attachment = this.getItemByKey(attachmentKey);
    if (!attachment) {
      return {
        action: "get_attachment_text",
        status: "error",
        summary: `Attachment ${attachmentKey} not found`,
        results: [],
        errors: ["Unknown attachment key"],
      };
    }

    const isAttachment =
      (typeof attachment.isAttachment === "function" && attachment.isAttachment()) ||
      String(attachment.itemType || "") === "attachment";

    if (!isAttachment) {
      return {
        action: "get_attachment_text",
        status: "error",
        summary: `Item ${attachmentKey} is not an attachment`,
        results: [],
        errors: ["Expected attachment item key"],
      };
    }

    let text = "";

    const fulltextAPI = (Zotero as AnyObject).Fulltext || (Zotero as AnyObject).FullText;
    if (fulltextAPI && typeof fulltextAPI.getItemContent === "function") {
      try {
        const content = await fulltextAPI.getItemContent(attachment.id);
        text = this.extractText(content);
      } catch (_error) {
        // fallback path below
      }
    }

    if (!text && typeof attachment.getFilePathAsync === "function") {
      try {
        const filePath = await attachment.getFilePathAsync();
        if (
          filePath &&
          Zotero.File &&
          typeof Zotero.File.getContentsAsync === "function" &&
          String(attachment.attachmentContentType || "").startsWith("text/")
        ) {
          const maybeText = await Zotero.File.getContentsAsync(filePath);
          text = typeof maybeText === "string" ? maybeText : "";
        }
      } catch (_error) {
        // keep empty
      }
    }

    if (!text) {
      return {
        action: "get_attachment_text",
        status: "partial",
        summary: "No extractable text found",
        results: [
          {
            item_id: attachmentKey,
            status: "skipped",
            details: "Attachment text unavailable or not indexed yet",
          },
        ],
        errors: [],
      };
    }

    return {
      action: "get_attachment_text",
      status: "ok",
      summary: `Retrieved text for attachment ${attachmentKey}`,
      results: [
        {
          item_id: attachmentKey,
          status: "ok",
          details: "Attachment text retrieved",
          data: {
            text,
            preview: text.slice(0, 800),
            length: text.length,
          },
        },
      ],
      errors: [],
    };
  }

  private extractText(content: any): string {
    if (!content) {
      return "";
    }

    if (typeof content === "string") {
      return content;
    }

    if (typeof content.text === "string") {
      return content.text;
    }

    if (typeof content.content === "string") {
      return content.content;
    }

    if (typeof content.body === "string") {
      return content.body;
    }

    return "";
  }

  private async handleFindFullText(payload: AnyObject): Promise<BridgeResponse> {
    const itemIDs = Array.isArray(payload.item_ids) ? payload.item_ids : [];
    if (!itemIDs.length) {
      return {
        action: "find_full_text",
        status: "error",
        summary: "No item IDs provided",
        results: [],
        errors: ["Provide item_ids array of item keys"],
      };
    }

    const results: BridgeResult[] = [];
    const errors: string[] = [];

    for (const rawID of itemIDs) {
      const itemKey = String(rawID);
      const item = this.getItemByKey(itemKey);
      if (!item) {
        const detail = `Item not found: ${itemKey}`;
        results.push({ item_id: itemKey, status: "error", details: detail });
        errors.push(detail);
        continue;
      }

      const beforeCount = item.getAttachments ? item.getAttachments().length : 0;
      try {
        const attachmentsAPI = (Zotero as AnyObject).Attachments;
        if (attachmentsAPI && typeof attachmentsAPI.addAvailablePDF === "function") {
          await attachmentsAPI.addAvailablePDF(item);
        } else if (
          attachmentsAPI &&
          typeof attachmentsAPI.addAvailablePDFs === "function"
        ) {
          await attachmentsAPI.addAvailablePDFs([item]);
        } else {
          results.push({
            item_id: itemKey,
            status: "skipped",
            details: "Full-text retrieval API not available in this Zotero build",
          });
          continue;
        }

        const refreshed = this.getItemByKey(itemKey);
        const afterCount = refreshed?.getAttachments ? refreshed.getAttachments().length : beforeCount;
        results.push({
          item_id: itemKey,
          status: "ok",
          details: `Full-text retrieval queued (attachments ${beforeCount} -> ${afterCount})`,
        });
      } catch (error: any) {
        const detail = `Full-text retrieval failed for ${itemKey}: ${String(error?.message || error)}`;
        results.push({
          item_id: itemKey,
          status: "error",
          details: detail,
        });
        errors.push(detail);
      }
    }

    return {
      action: "find_full_text",
      status: this.normalizeStatus(results, errors),
      summary: `Processed full-text retrieval for ${itemIDs.length} items`,
      results,
      errors,
    };
  }

  private async handleAddTags(payload: AnyObject): Promise<BridgeResponse> {
    const itemKey = String(payload.item_id || "").trim();
    const tags = Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()) : [];

    if (!itemKey || !tags.length) {
      return {
        action: "add_tags",
        status: "error",
        summary: "Item and tags are required",
        results: [],
        errors: ["Provide item_id and tags"],
      };
    }

    const item = this.getItemByKey(itemKey);
    if (!item) {
      return {
        action: "add_tags",
        status: "error",
        summary: `Item ${itemKey} not found`,
        results: [],
        errors: ["Unknown item key"],
      };
    }

    for (const tag of tags) {
      if (tag) {
        item.addTag(tag);
      }
    }

    await item.saveTx();

    return {
      action: "add_tags",
      status: "ok",
      summary: `Added ${tags.length} tags to ${itemKey}`,
      results: [
        {
          item_id: itemKey,
          status: "ok",
          details: `Tags added: ${tags.join(", ")}`,
        },
      ],
      errors: [],
    };
  }

  private async handleMoveToCollection(payload: AnyObject): Promise<BridgeResponse> {
    const itemKey = String(payload.item_id || "").trim();
    const collectionPath = String(payload.collection_path || "").trim();

    if (!itemKey || !collectionPath) {
      return {
        action: "move_to_collection",
        status: "error",
        summary: "Item and collection path are required",
        results: [],
        errors: ["Provide item_id and collection_path"],
      };
    }

    const item = this.getItemByKey(itemKey);
    if (!item) {
      return {
        action: "move_to_collection",
        status: "error",
        summary: `Item ${itemKey} not found`,
        results: [],
        errors: ["Unknown item key"],
      };
    }

    const collection = await this.findOrCreateCollectionPath(collectionPath);
    if (!collection) {
      return {
        action: "move_to_collection",
        status: "error",
        summary: "Collection resolution failed",
        results: [],
        errors: ["Could not resolve collection path"],
      };
    }

    item.addToCollection(collection.id);
    await item.saveTx();

    return {
      action: "move_to_collection",
      status: "ok",
      summary: `Item ${itemKey} added to ${collectionPath}`,
      results: [
        {
          item_id: itemKey,
          status: "ok",
          details: `Added to collection ${collectionPath}`,
          data: {
            collection_id: collection.id,
          },
        },
      ],
      errors: [],
    };
  }

  private async findOrCreateCollectionPath(path: string): Promise<any | null> {
    const segments = path
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    const libraryID = this.getLibraryID();
    let parentID: number | false = false;
    let currentCollection: any = null;

    for (const segment of segments) {
      let found = this.findCollectionByName(libraryID, segment, parentID);
      if (!found) {
        const collection = new Zotero.Collection();
        (collection as AnyObject).libraryID = libraryID;
        (collection as AnyObject).name = segment;
        if (parentID) {
          collection.parentID = parentID;
        }
        await collection.saveTx();
        found = collection;
      }

      currentCollection = found;
      parentID = Number(found.id);
    }

    return currentCollection;
  }

  private findCollectionByName(
    libraryID: number,
    name: string,
    parentID: number | false,
  ): any | null {
    if (!Zotero.Collections || typeof Zotero.Collections.getByLibrary !== "function") {
      return null;
    }

    const collections = Zotero.Collections.getByLibrary(libraryID) || [];
    for (const rawCollection of collections) {
      const collection =
        typeof rawCollection === "number" && typeof Zotero.Collections.get === "function"
          ? Zotero.Collections.get(rawCollection)
          : rawCollection;
      if (!collection) {
        continue;
      }

      const collectionData = collection as AnyObject;
      const collectionParent = collectionData.parentID || false;
      if (collectionData.name === name && collectionParent === parentID) {
        return collection;
      }
    }

    return null;
  }

  private async handleCreateNote(payload: AnyObject): Promise<BridgeResponse> {
    const itemKey = String(payload.item_id || "").trim();
    const noteText = String(payload.note_text || "").trim();

    if (!itemKey || !noteText) {
      return {
        action: "create_note",
        status: "error",
        summary: "Item and note text are required",
        results: [],
        errors: ["Provide item_id and note_text"],
      };
    }

    const parentItem = this.getItemByKey(itemKey);
    if (!parentItem) {
      return {
        action: "create_note",
        status: "error",
        summary: `Item ${itemKey} not found`,
        results: [],
        errors: ["Unknown item key"],
      };
    }

    const note = new Zotero.Item("note");
    (note as AnyObject).libraryID = this.getLibraryID();
    note.parentID = parentItem.id;
    note.setNote(this.toNoteHtml(noteText));
    await note.saveTx();

    return {
      action: "create_note",
      status: "ok",
      summary: `Created note under ${itemKey}`,
      results: [
        {
          item_id: note.key,
          status: "ok",
          details: "Note created",
        },
      ],
      errors: [],
    };
  }

  private toNoteHtml(noteText: string): string {
    const escaped = noteText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const lines = escaped.split(/\r?\n/g).filter((line) => line.trim().length > 0);
    return lines.map((line) => `<p>${line}</p>`).join("") || `<p>${escaped}</p>`;
  }

  private async resolveItemsFromPayload(payload: AnyObject): Promise<any[]> {
    const rawIDs = Array.isArray(payload.item_ids) ? payload.item_ids : [];
    const items: any[] = [];

    for (const rawID of rawIDs) {
      const item = this.getItemByKey(String(rawID));
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  private async handleFormatCitation(payload: AnyObject): Promise<BridgeResponse> {
    const style = String(payload.style || "apa");
    const items = await this.resolveItemsFromPayload(payload);

    if (!items.length) {
      return {
        action: "format_citation",
        status: "error",
        summary: "No valid items provided",
        results: [],
        errors: ["Provide item_ids with item keys"],
      };
    }

    const citation = await this.formatItems(items, style, "citation");
    return {
      action: "format_citation",
      status: "ok",
      summary: `Formatted citation for ${items.length} item(s)`,
      results: [
        {
          status: "ok",
          details: "Citation generated",
          data: {
            style,
            citation,
          },
        },
      ],
      errors: [],
    };
  }

  private async handleFormatBibliography(payload: AnyObject): Promise<BridgeResponse> {
    const style = String(payload.style || "apa");
    const items = await this.resolveItemsFromPayload(payload);

    if (!items.length) {
      return {
        action: "format_bibliography",
        status: "error",
        summary: "No valid items provided",
        results: [],
        errors: ["Provide item_ids with item keys"],
      };
    }

    const bibliography = await this.formatItems(items, style, "bibliography");
    return {
      action: "format_bibliography",
      status: "ok",
      summary: `Formatted bibliography for ${items.length} item(s)`,
      results: [
        {
          status: "ok",
          details: "Bibliography generated",
          data: {
            style,
            bibliography,
          },
        },
      ],
      errors: [],
    };
  }

  private async formatItems(
    items: any[],
    styleNameOrID: string,
    mode: "citation" | "bibliography",
  ): Promise<string> {
    try {
      const styles = (Zotero as AnyObject).Styles;
      const cite = (Zotero as AnyObject).Cite;
      if (!styles || !cite) {
        return this.fallbackFormat(items, mode);
      }

      let style = styles.get(styleNameOrID);
      if (!style && typeof styles.getVisible === "function") {
        const visibleStyles = styles.getVisible() || [];
        style = visibleStyles.find((candidate: AnyObject) => {
          const id = String(candidate.styleID || "").toLowerCase();
          const title = String(candidate.title || "").toLowerCase();
          const target = styleNameOrID.toLowerCase();
          return id === target || title === target || id.endsWith(`/${target}`);
        });
      }

      if (!style || typeof style.getCiteProc !== "function") {
        return this.fallbackFormat(items, mode);
      }

      const cslEngine = style.getCiteProc("en-US");
      if (mode === "bibliography" && typeof cite.makeFormattedBibliographyOrCitationList === "function") {
        return String(cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "text") || "");
      }

      if (mode === "citation" && typeof cite.makeFormattedCitationCluster === "function") {
        const citationItems = items.map((item) => ({ id: item.id }));
        return String(
          cite.makeFormattedCitationCluster(
            cslEngine,
            {
              citationItems,
              properties: {},
            },
            "text",
          ) || "",
        );
      }

      return this.fallbackFormat(items, mode);
    } catch (_error) {
      return this.fallbackFormat(items, mode);
    }
  }

  private fallbackFormat(items: any[], mode: "citation" | "bibliography"): string {
    if (mode === "citation") {
      const parts = items.map((item) => {
        const title = String(item.getField("title") || "Untitled");
        const yearRaw = String(item.getField("date") || "");
        const year = yearRaw.slice(0, 4);
        const creators = item.getCreators?.() || [];
        const firstCreator = creators[0];
        const surname = firstCreator?.lastName || firstCreator?.name || "Anon";
        return `${surname}, ${year || "n.d."}: ${title}`;
      });
      return `(${parts.join("; ")})`;
    }

    return items
      .map((item) => {
        const creators = item.getCreators?.() || [];
        const authorList = creators
          .map((creator: AnyObject) => creator.lastName || creator.name || "Anon")
          .join(", ");
        const yearRaw = String(item.getField("date") || "");
        const year = yearRaw.slice(0, 4) || "n.d.";
        const title = String(item.getField("title") || "Untitled");
        const journal = String(item.getField("publicationTitle") || "");
        const doi = String(item.getField("DOI") || "");
        return `${authorList} (${year}). ${title}. ${journal}${doi ? `. https://doi.org/${doi}` : ""}`.trim();
      })
      .join("\n");
  }
}
