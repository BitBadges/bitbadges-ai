import React, { useState, useEffect } from 'react';
import {
    Settings,
    Zap,
    X,
    Wallet,
    FileText,
    BookOpen,
    ExternalLink,
} from 'lucide-react';
import { Plugin } from '../types';
import { apiService } from '../services/api';
import { WalletSetup } from './WalletSetup';
import { WalletBalance } from './WalletBalance';
import { cn } from '../utils/cn';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<
        'plugins' | 'wallet' | 'settings'
    >('plugins');
    const [hasWallet, setHasWallet] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | undefined>();
    const [walletBalance, setWalletBalance] = useState<string | null>(null);

    // Settings state
    const [apiKey, setApiKey] = useState('');
    const [creatorAddress, setCreatorAddress] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPlugins();
            loadSettings();
        }
    }, [isOpen]);

    const loadPlugins = async () => {
        try {
            setLoading(true);
            const pluginList = await apiService.getPlugins();
            setPlugins(pluginList);
        } catch (error) {
            console.error('Failed to load plugins:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const settings = await apiService.getSettings();
            setApiKey(settings.apiKey || '');
            setCreatorAddress(settings.creatorAddress || '');
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    };

    const saveSettings = async () => {
        try {
            setSettingsLoading(true);
            setSettingsSaved(false);

            await apiService.saveSettings({
                apiKey: apiKey.trim(),
                chainId: 'bitbadges-1', // Default to mainnet
                creatorAddress: creatorAddress.trim(),
            });

            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings. Please try again.');
        } finally {
            setSettingsLoading(false);
        }
    };

    const getPluginIcon = (name: string) => {
        switch (name) {
            case 'bitbadges':
                return <Zap size={16} />;
            case 'wallet':
                return <Wallet size={16} />;
            case 'tx':
                return <FileText size={16} />;
            default:
                return <Settings size={16} />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 lg:relative lg:inset-auto">
            {/* Overlay for mobile */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 lg:hidden"
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl lg:relative lg:w-full lg:shadow-none animate-slide-up">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        Agent Configuration
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded lg:hidden"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('plugins')}
                        className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium',
                            activeTab === 'plugins'
                                ? 'border-b-2 border-bitbadges-500 text-bitbadges-600'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        Plugins
                    </button>
                    <button
                        onClick={() => setActiveTab('wallet')}
                        className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium',
                            activeTab === 'wallet'
                                ? 'border-b-2 border-bitbadges-500 text-bitbadges-600'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        Wallet
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={cn(
                            'flex-1 px-3 py-2 text-sm font-medium',
                            activeTab === 'settings'
                                ? 'border-b-2 border-bitbadges-500 text-bitbadges-600'
                                : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        Settings
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'plugins' && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-3">
                                Available Plugins
                            </h3>

                            {loading ? (
                                <div className="space-y-3">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="animate-pulse">
                                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                            <div className="h-3 bg-gray-200 rounded w-full"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {plugins.map((plugin) => (
                                        <div
                                            key={plugin.name}
                                            className="p-3 border rounded-lg hover:bg-gray-50"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                {getPluginIcon(plugin.name)}
                                                <span className="font-medium font-mono text-sm">
                                                    /{plugin.name}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                {plugin.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">
                                    Usage Examples
                                </h4>
                                <div className="space-y-2 text-xs font-mono">
                                    <div className="text-blue-700 break-words">
                                        /wallet status
                                    </div>
                                    <div className="text-blue-700 break-words">
                                        /wallet balance
                                    </div>
                                    <div className="text-blue-700 break-words">
                                        /tx status
                                    </div>
                                    <div className="text-blue-700 break-words">
                                        /tx transfer{' '}
                                        {`{"prompt": "Transfer 5 badges from bb1a to bb1k"}`}
                                    </div>
                                    <div className="text-blue-700 break-words">
                                        /tx simulate{' '}
                                        {`{"prompt": "Transfer 5 badges from bb1a to bb1k"}`}
                                    </div>
                                    <div className="text-blue-700 break-words">
                                        /tx broadcast{' '}
                                        {`{"prompt": "Transfer 5 badges from bb1a to bb1k"}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'wallet' && (
                        <div className="space-y-6">
                            <WalletBalance
                                hasWallet={hasWallet}
                                address={walletAddress}
                                className="mb-6"
                                onBalanceLoad={(balance) =>
                                    setWalletBalance(balance)
                                }
                            />

                            {hasWallet &&
                                walletAddress &&
                                walletBalance !== null &&
                                parseFloat(walletBalance) === 0 && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <h4 className="text-sm font-medium text-blue-800 mb-2">
                                            💰 Fund Your Agent Wallet
                                        </h4>
                                        <p className="text-xs text-blue-700">
                                            To perform transactions, send $BADGE
                                            credits to your agent's wallet
                                            address on the{' '}
                                            <a
                                                href="https://bitbadges.io"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline hover:no-underline"
                                            >
                                                BitBadges website
                                            </a>
                                            . The agent needs credits to pay for
                                            transaction fees.
                                        </p>
                                    </div>
                                )}

                            <WalletSetup
                                onWalletChange={(walletHasWallet, address) => {
                                    setHasWallet(walletHasWallet);
                                    setWalletAddress(address);
                                    console.log('Wallet changed:', {
                                        hasWallet: walletHasWallet,
                                        address,
                                    });
                                }}
                            />
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    BitBadges API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your API key..."
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bitbadges-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Optional: Provide your BitBadges API key for
                                    authenticated requests
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Creator Address
                                </label>
                                <input
                                    type="text"
                                    value={creatorAddress}
                                    onChange={(e) =>
                                        setCreatorAddress(e.target.value)
                                    }
                                    placeholder="Enter BitBadges address (e.g., bb1...) or leave empty for AI agent wallet"
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-bitbadges-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Optional: BitBadges address to use as the
                                    creator/sender for transactions. Leave empty
                                    to use the AI agent's wallet.
                                </p>
                                {creatorAddress.trim() && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                        <p className="text-xs text-amber-800">
                                            <strong>⚠️ Important:</strong> When
                                            using a custom creator address, you
                                            must add the AI agent's address as
                                            an approved transactor in your
                                            BitBadges account settings for
                                            transactions to work properly.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <button
                                    onClick={saveSettings}
                                    disabled={settingsLoading}
                                    className={cn(
                                        'w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                                        settingsSaved
                                            ? 'bg-green-100 text-green-800 border border-green-300'
                                            : 'bg-bitbadges-500 text-white hover:bg-bitbadges-600 disabled:opacity-50 disabled:cursor-not-allowed'
                                    )}
                                >
                                    {settingsLoading
                                        ? 'Saving...'
                                        : settingsSaved
                                        ? '✓ Settings Saved'
                                        : 'Save Settings'}
                                </button>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">
                                    Relevant Links
                                </h4>

                                <div className="space-y-2">
                                    <a
                                        href="https://docs.bitbadges.io"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <BookOpen size={14} />
                                        <span>BitBadges Documentation</span>
                                        <ExternalLink
                                            size={12}
                                            className="ml-auto"
                                        />
                                    </a>

                                    <a
                                        href="https://bitbadges.io/dev/broadcast"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Settings size={14} />
                                        <span>Custom Transaction Builder</span>
                                        <ExternalLink
                                            size={12}
                                            className="ml-auto"
                                        />
                                    </a>

                                    <a
                                        href="https://bitbadges.stoplight.io/docs/bitbadges"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <FileText size={14} />
                                        <span>API Documentation</span>
                                        <ExternalLink
                                            size={12}
                                            className="ml-auto"
                                        />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
