import { exec, execSync } from 'child_process';
import { browser, promise } from 'protractor';

import { OEAttributes } from './OEAttributes.enum';
import { OEButtons } from './OEButtons.enum';
import { OEConfig } from './OEConfig';
import { OEElement } from './OEElement';
import { OEEvents } from './OEEvents.enum';
import { OESocket } from './OESocket';
import { MessageType, OEUtils } from './OEUtils';

/**
 * Provides the interaction between the e2e Protractor tests and
 * Progress OpenEdge applications.
 */
export class OEAgent {
  constructor(private oeSocket = new OESocket()) {}

  /**
   * Starts the agent application.
   *
   * @param config Configuration object.
   * @returns A promise result of the agent initialization and connection.
   */
  public start(config: OEConfig): promise.Promise<boolean | Error> {
    return browser.call(() => {
      const cmd = this.buildCommandLine(config);
      const cwd = `${__dirname.replace(/\\/g, '/')}/abl/`;

      OEUtils.consoleLogMessage(`Executing OpenEdge with command line: ${cmd}`, MessageType.INFO);
      OEUtils.consoleLogMessage(`Current working directory: ${cwd}`, MessageType.INFO);

      const run = exec(cmd, { cwd: cwd });

      // Will use "race" to guess if Progress OE has been successfully opened.
      // This is not a 100% guarantee thing.
      const suc = new Promise((resolve) => setTimeout(() => resolve({ status: true }), 5 * 1000));
      const err = new Promise((resolve) => run.on('error', (error: Error) => resolve({ status: false, error: error })));

      return Promise.race([suc, err]).then((result) => {
        return result['status'] ? this.connect(config.host, config.port) : Promise.reject(result['error']);
      });
    });
  }

  /**
   * Connects to the agent server.
   *
   * @param host Agent server host name or IP address.
   * @param port Agent server port number.
   */
  public connect(host: string, port: number): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.connect(host, port));
  }

  /**
   * Returns the agent server connection status.
   * @returns ```true``` if the agent server is connected.
   */
  public connected(): boolean {
    return this.oeSocket.connected();
  }

  /**
   * Waits until an OE window with the informed title is found or a timeout
   * error is raised.
   *
   * @param title OE window title (full or partial).
   * @param timeout Waiting timeout.
   *
   * @returns Window ```OEElement``` instance.
   */
  public waitForWindow(title: string, timeout = 10000): OEElement {
    const element = new OEElement(this);

    browser.wait(() => {
      return this.oeSocket.send(true, 'FINDWINDOW', title)
        .then((id: string) => element.id = parseInt(id));
    }, timeout);

    return element;
  }

  /**
   * Searches for an OE window with the informed title.
   *
   * @param title OE window title (full or partial).
   * @returns Window ```OEElement``` instance.
   */
  public findWindow(title: string): OEElement {
    const element: OEElement = new OEElement(this);

    browser.call(() => {
      return this.oeSocket.send(true, 'FINDWINDOW', title)
        .then((id: string) => (element.id = parseInt(id)));
    });

    return element;
  }

  /**
   * Wait until an OE widget is found with the informed name attribute or a
   * timeout error is raised.
   *
   * @param name Widget ```NAME``` attribute.
   * @param visible ```true``` to only search visible elements.
   * @param timeout Waiting timeout.
   * @param parent Parent ```OEElement``` instance, if informed the agent
   * will consider a search only by its children.
   *
   * @returns Widget ```OEElement``` instance.
   */
  public waitForElement(name: string, visible = true, timeout = 10000, parent?: OEElement): OEElement {
    const element = new OEElement(this);
    const parentId = parent ? parent.id : '';

    browser.wait(() => {
      return this.oeSocket.send(true, 'FINDELEMENT', name, visible, parentId)
        .then((id: string) => (element.id = parseInt(id))).catch(() => browser.sleep(2000));
    }, timeout);

    return element;
  }

  /**
   * Searches for an OE widget with the informed name attribute.
   *
   * @param name Widget ```NAME``` attribute.
   * @param visible ```true``` to only search visible elements.
   * @param parent Parent ```OEElement``` instance, if informed the agent
   * will consider a search only by its children.
   *
   * @returns Widget ```OEElement``` instance.
   */
  public findElement(name: string, visible = true, parent?: OEElement): OEElement {
    const element = new OEElement(this);
    const parentId = parent ? parent.id : '';

    browser.call(() => {
      return this.oeSocket.send(true, 'FINDELEMENT', name, visible, parentId)
        .then((id: string) => (element.id = parseInt(id)));
    });

    return element;
  }

  /**
   * Search for an OE widget with the value of the informed attribute.
   *
   * @param attr Attribute name.
   * @param value Attribute value.
   * @param visible ```true``` to only search visible elements.
   * @param parent Parent ```OEElement``` instance, if informed the agent
   * will consider a search only by its children.
   *
   * @returns Widget ```OEElement``` instance.
   */
  public findElementByAttribute(attribute: OEAttributes, value: string, visible = true, parent?: OEElement): OEElement {
    const element = new OEElement(this);
    const parentId = parent ? parent.id : '';

    browser.call(() => {
      return this.oeSocket.send(true, 'FINDELEMENTBYATTRIBUTE', attribute, value, visible, parentId)
        .then((id: string) => (element.id = parseInt(id)));
    });

    return element;
  }

  /**
   * Clears the widget ```SCREEN-VALUE```.
   *
   * @param element Widget ```OEElement``` instance.
   * @returns A promise result of the command.
   */
  public clear(element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'CLEAR', element.id).then(() => true));
  }

  /**
   * Changes the widget ```SCREEN-VALUE```.
   *
   * @param value Widget's new ```SCREEN-VALUE```.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public sendKeys(value: string | number, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'SENDKEYS', element.id, value).then(() => true));
  }

  /**
   * Checks/Unchecks a TOGGLE-BOX widget.
   *
   * @param check ```true``` to check the widget.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public check(check: boolean, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'CHECK', element.id, check).then(() => true));
  }

  /**
   * Selects a value in a COMBO-BOX or RADIO-SET widget.
   *
   * @param value Selection value.
   * @param partial ```true``` if it's a partial value.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public select(value: string | number, partial = false, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'SELECT', element.id, value, partial).then(() => true));
  }

  /**
   * Selects a row in a BROWSE widget.
   *
   * @param row Row number.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public selectRow(row: number, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'SELECTROW', element.id, row).then(() => true));
  }

  /**
   * Moves a QUERY result pointer of a BROWSE widget to the specified row.
   *
   * @param row Row number.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public repositionToRow(row: number, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'REPOSITIONTOROW', element.id, row).then(() => true));
  }

  /**
   * Fire the widget ```CHOOSE``` event.
   *
   * @param element Widget ```OEElement``` instance.
   * @returns A promise result of the command.
   */
  public choose(element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(false, 'CHOOSE', element.id).then(() => browser.sleep(500)).then(() => true));
  }

  /**
   * Sends an ```APPLY``` command with an event to the widget.
   *
   * @param event Event name.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public apply(event: OEEvents | string, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(false, 'APPLY', element.id, event).then(() => browser.sleep(500)).then(() => true));
  }

  /**
   * Gets the widget's informed attribute value.
   *
   * @param attr Attribute name.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result data of the command.
   */
  public get(attr: OEAttributes | string, element: OEElement): promise.Promise<string> {
    return browser.call(() => this.oeSocket.send(true, 'GET', element.id, attr));
  }

  /**
   * Sets the widget's informed attribute value.
   *
   * @param attr Attribute name.
   * @param value Attribute value.
   * @param element Widget ```OEElement``` instance.
   *
   * @returns A promise result of the command.
   */
  public set(attr: OEAttributes | string, value: string, element: OEElement): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'SET', element.id, attr, value).then(() => true));
  }

  /**
   * Selects one or more records of the informed table.
   *
   * @param table Table name.
   * @param where Query's WHERE clause.
   *
   * @returns A promise result data of the command.
   *
   * @example
   * ```typescript
   * const oe = new OEAgent();
   * let data: Object;
   *
   * oe.query("Department", "WHERE DeptCode = 'PRC'").then((result) => data = result);
   *
   * // The result of data will be:
   * // {
   * //   "Department": [{
   * //     "DeptCode": "PRC",
   * //     "DeptName": "Purchasing"
   * //   }]
   * // };
   * ```
   */
  public query(table: string, where: string): promise.Promise<Object | Error> {
    return browser.call(() => this.oeSocket.send(true, 'QUERY', table, where).then((result) => JSON.parse(result)));
  }

  /**
   * Creates one or more records in the informed table.
   *
   * @param table Table name.
   * @param data TEMP-TABLE "like" JSON with the records.
   *
   * @returns A promise result of the command.
   *
   * @example
   * ```typescript
   * const oe = new OEAgent();
   * const data = {
   *   "Department": [{
   *     "DeptCode": "PRC",
   *     "DeptName": "Purchasing"
   *   },{
   *     "DeptCode": "HRM",
   *     "DeptName": "HR Management"
   *   }]
   * };
   *
   * oe.create("Department", data);
   * ```
   */
  public create(table: string, data: Object): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'CREATE', table, JSON.stringify(data)).then(() => true));
  }

  /**
   * Updates one or more records of the informed table.
   *
   * @param table Table name.
   * @param data TEMP-TABLE "like" JSON with the records.
   * @param index Table index columns.
   *
   * @returns A promise result of the command.
   *
   * @example
   * ```typescript
   * const oe = new OEAgent();
   * const data = {
   *   "Department": [{
   *     "DeptCode": "PRC",
   *     "DeptName": "Purchasing Dept."
   *   },{
   *     "DeptCode": "HRM",
   *     "DeptName": "HR Managm. Dept."
   *   }]
   * };
   *
   * oe.update("Department", data, ["DeptCode"]);
   * ```
   */
  public update(table: string, data: Object, index: string[]): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'UPDATE', table, JSON.stringify(data), JSON.stringify(index)).then(() => true));
  }

  /**
   * Deletes one or more records of the informed table.
   *
   * @param table Table name.
   * @param data TEMP-TABLE "like" JSON with the records.
   * @param index Table index columns.
   *
   * @returns A promise result of the command.
   *
   * @example
   * ```typescript
   * const oe = new OEAgent();
   * const data = {
   *   "Department": [{
   *     "DeptCode": "PRC"
   *   },{
   *     "DeptCode": "HRM"
   *   }]
   * };
   *
   * oe.delete("Department", data, ["DeptCode"]);
   * ```
   */
  public delete(table: string, data: {}, index: string[]): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(true, 'DELETE', table, JSON.stringify(data), JSON.stringify(index)).then(() => true));
  }

  /**
   * Sends a ```RUN``` command to open an OE application.
   *
   * @param run OE application path (full or partial according to PROPATH).
   * @param params Application input parameters.
   *
   * @returns A promise result of the command.
   */
  public run(run: string, params: string[] = []): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(false, 'RUN', run, params).then(() => browser.sleep(500))).then(() => true);
  }

  /**
   * Sends a ```QUIT``` command to the agent.
   * This will close all comunication with the agent server.
   *
   * @returns A promise result of the command.
   */
  public quit(): promise.Promise<boolean | Error> {
    return browser.call(() => this.oeSocket.send(false, `QUIT`).then(() => browser.sleep(500))).then(() => true);
  }

  /**
   * Tests if an application exists with the informed title.
   * OBS: this uses Robot and will consider all opened applications in the OS.
   *
   * @param title Window title.
   * @param timeout Waiting timeout.
   *
   * @returns A promise result of the command.
   */
  public windowExists(title: string, timeout = 10000): promise.Promise<boolean> {
    return browser.call(() => new Promise((resolve) => {
      let winExists = true;

      try {
        execSync(`${__dirname.replace(/\\/g, '/')}/robot/Robot.exe -t ${timeout} -w "${title}"`);
      } catch (error) {
        winExists = false;
      }

      resolve(winExists);
    }));
  }

  /**
   * Sends keyboard events to an application with the informed title.
   * OBS: this uses Robot and will consider all opened applications in the OS.
   *
   * @param title Window title.
   * @param keys Keyboard events.
   * @param timeout Waiting timeout.
   *
   * @returns A promise result of the command.
   */
  public windowSendKeys(title: string, keys: string | string[], timeout = 10000): promise.Promise<boolean | Error> {
    return browser.call(() => new Promise((resolve, reject) => {
      keys = Array.isArray(keys) ? keys : [keys];
      keys = keys.join('');

      try {
        execSync(`${__dirname.replace(/\\/g, '/')}/robot/Robot.exe -t ${timeout} -w "${title}" -k ${keys}`);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    }));
  }

  /**
   * Sends an "OK" click in an OE alert-box error message.
   * @returns A promise result of the command.
   */
  public alertErrorOK(): promise.Promise<boolean | Error> {
    return this.alertClick('Error', OEButtons.OK);
  }

  /**
   * Send an "OK" click in an OE alert-box warning message.
   * @returns A promise result of the command.
   */
  public alertWarningOK(): promise.Promise<boolean | Error> {
    return this.alertClick('Warning', OEButtons.OK);
  }

  /**
   * Send an "OK" click in an OE alert-box info message.
   * @returns A promise result of the command.
   */
  public alertInfoOK(): promise.Promise<boolean | Error> {
    return this.alertClick('Information', OEButtons.OK);
  }

  /**
   * Send a "YES" click in an OE alert-box question message.
   * @returns A promise result of the command.
   */
  public alertQuestionYes(): promise.Promise<boolean | Error> {
    return this.alertClick('Question', OEButtons.YES);
  }

  /**
   * Send a "NO" click in an OE alert-box question message.
   * @returns A promise result of the command.
   */
  public alertQuestionNo(): promise.Promise<boolean | Error> {
    return this.alertClick('Question', OEButtons.NO);
  }

  /**
   * Sends a click to an OE alert-box message.
   *
   * @param title Alert-box message title.
   * @param button Button type.
   * @param timeout Waiting timeout.
   *
   * @returns A promise result of the command.
   */
  public alertClick(title: string, button: OEButtons, timeout = 10000): promise.Promise<boolean | Error> {
    return browser.call(() => new Promise((resolve, reject) => {
      try {
        execSync(`${__dirname.replace(/\\/g, '/')}/robot/Robot.exe -t ${timeout} -w "${title}" -b ${button}`);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    }));
  }

  /**
   * Build the command line to start the agent application.
   *
   * @param config Configuration object.
   * @returns Built command line.
   */
  private buildCommandLine(config: OEConfig): string {
    let prm = '';
    let cmd = '';

    // Load the session parameters.
    prm += `${config.host},`;
    prm += `${config.port},`;
    prm += `${config.outDir},`;
    prm += `${(config.propath || []).join('|')},`;
    prm += `${config.startupFile},`;
    prm += `${(config.startupFileParams || []).join('|')},`;
    prm += `${config.inputCodepage || 'UTF-8'}`;

    // Load the command line.
    cmd += `"${config.dlcHome}/bin/prowin32.exe"`;
    cmd += ` -p "${__dirname.replace(/\\/g, '/')}/abl/OEStart.p"`;
    cmd += ` -param "${prm}"`;

    if (config.parameterFile) {
      cmd += ` -pf "${config.parameterFile}"`;
    }

    if (config.iniFile) {
      cmd += ` -basekey ini -ininame "${config.iniFile}"`;
    }

    return cmd;
  }
}
