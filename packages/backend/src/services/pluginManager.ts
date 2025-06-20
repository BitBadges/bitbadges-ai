import { Plugin, CommandResult } from '../types';
import { bitbadgesPlugin } from '../plugins/bitbadges';
import { walletPlugin } from '../plugins/wallet';
import { protoPlugin } from '../plugins/proto';
import { docsPlugin } from '../plugins/docs';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  constructor() {
    this.registerDefaultPlugins();
  }

  private registerDefaultPlugins() {
    this.registerPlugin(bitbadgesPlugin);
    this.registerPlugin(walletPlugin);
    this.registerPlugin(protoPlugin);
    this.registerPlugin(docsPlugin);
  }

  registerPlugin(plugin: Plugin) {
    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin registered: ${plugin.name}`);
  }

  async executeCommand(command: string, args: any[]): Promise<CommandResult> {
    const plugin = this.plugins.get(command);
    
    if (!plugin) {
      return {
        success: false,
        error: `Unknown command: ${command}. Available commands: ${Array.from(this.plugins.keys()).join(', ')}`
      };
    }

    try {
      return await plugin.execute(args);
    } catch (error) {
      return {
        success: false,
        error: `Error executing command ${command}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  getAvailableCommands(): string[] {
    return Array.from(this.plugins.keys());
  }

  getPluginInfo(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}