import React, { useState, useEffect } from 'react';
import {
    Wallet,
    Key,
    Shield,
    AlertCircle,
    CheckCircle,
    Copy,
    Eye,
    EyeOff,
} from 'lucide-react';
import { apiService } from '../services/api';
import { WalletStatus, WalletConfig } from '../types';
import { cn } from '../utils/cn';

interface WalletSetupProps {
    onWalletChange?: (hasWallet: boolean, address?: string) => void;
}

export const WalletSetup: React.FC<WalletSetupProps> = ({ onWalletChange }) => {
    const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Setup form state
    const [setupMode, setSetupMode] = useState<'auto' | 'manual'>('auto');
    const [mnemonic, setMnemonic] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(
        null
    );

    // Load wallet state
    const [loadPassword, setLoadPassword] = useState('');
    const [showLoadForm, setShowLoadForm] = useState(false);

    useEffect(() => {
        loadWalletStatus();
    }, []);

    const loadWalletStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const status = await apiService.getWalletStatus();
            setWalletStatus(status);
            onWalletChange?.(status.hasWallet, status.address || undefined);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to load wallet status'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWallet = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            if (usePassword && password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }

            const config: WalletConfig = {
                autoGenerate: setupMode === 'auto',
                mnemonic: setupMode === 'manual' ? mnemonic : undefined,
                password: usePassword ? password : undefined,
            };

            const result = await apiService.createWallet(config);

            if (result.mnemonic) {
                setGeneratedMnemonic(result.mnemonic);
            }

            setSuccess(
                `Wallet created successfully! Address: ${result.address}`
            );
            await loadWalletStatus();

            // Clear form
            setMnemonic('');
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to create wallet'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleLoadWallet = async () => {
        try {
            setLoading(true);
            setError(null);

            const result = await apiService.loadWallet(loadPassword);
            setSuccess(
                `Wallet loaded successfully! Address: ${result.address}`
            );
            await loadWalletStatus();

            setLoadPassword('');
            setShowLoadForm(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to load wallet'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWallet = async () => {
        if (
            !confirm(
                'Are you sure you want to delete the wallet? This action cannot be undone.'
            )
        ) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await apiService.deleteWallet();
            setSuccess('Wallet deleted successfully');
            await loadWalletStatus();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to delete wallet'
            );
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard!');
        setTimeout(() => setSuccess(null), 2000);
    };

    if (loading && !walletStatus) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bitbadges-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Wallet className="text-bitbadges-500" size={24} />
                <h2 className="text-xl font-semibold">AI Agent Wallet</h2>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle size={16} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    <CheckCircle size={16} />
                    <span className="text-sm">{success}</span>
                </div>
            )}

            {generatedMnemonic && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold text-yellow-800 mb-2">
                        ⚠️ Save Your Mnemonic
                    </h3>
                    <p className="text-sm text-yellow-700 mb-3">
                        This is your wallet's recovery phrase. Store it safely -
                        you won't see it again!
                    </p>
                    <div className="relative">
                        <textarea
                            value={generatedMnemonic}
                            readOnly
                            className="w-full p-3 bg-white border rounded font-mono text-sm resize-none"
                            rows={3}
                        />
                        <button
                            onClick={() => copyToClipboard(generatedMnemonic)}
                            className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                    <button
                        onClick={() => setGeneratedMnemonic(null)}
                        className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                        I've Saved It Safely
                    </button>
                </div>
            )}

            {walletStatus?.hasWallet ? (
                <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="font-semibold text-green-800 mb-2">
                            ✅ Wallet Active
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="space-y-1">
                                <span className="text-green-700 text-sm">
                                    Address:
                                </span>
                                <div className="flex items-start gap-2">
                                    <code className="bg-white px-2 py-1 rounded font-mono text-xs break-all word-break leading-tight flex-1">
                                        {walletStatus.address}
                                    </code>
                                    <button
                                        onClick={() =>
                                            copyToClipboard(
                                                walletStatus.address || ''
                                            )
                                        }
                                        className="p-1 hover:bg-green-100 rounded flex-shrink-0"
                                        title="Copy address"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>{' '}
                            <div className="space-y-1">
                                <span className="text-green-700 text-sm">
                                    BitBadges Address:
                                </span>
                                <div className="flex items-start gap-2">
                                    <code className="bg-white px-2 py-1 rounded font-mono text-xs break-all word-break leading-tight flex-1">
                                        {walletStatus.bitbadgesAddress}
                                    </code>
                                    <button
                                        onClick={() =>
                                            copyToClipboard(
                                                walletStatus.bitbadgesAddress ||
                                                    ''
                                            )
                                        }
                                        className="p-1 hover:bg-green-100 rounded flex-shrink-0"
                                        title="Copy address"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-green-700">
                                Encrypted:{' '}
                                {walletStatus.encrypted ? '🔒 Yes' : '🔓 No'}
                            </div>
                            {walletStatus.createdAt && (
                                <div className="text-green-700">
                                    Created:{' '}
                                    {new Date(
                                        walletStatus.createdAt
                                    ).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleDeleteWallet}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                    >
                        Delete Wallet
                    </button>
                </div>
            ) : walletStatus?.walletExists ? (
                <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h3 className="font-semibold text-yellow-800 mb-2">
                            🔒 Wallet Locked
                        </h3>
                        <p className="text-sm text-yellow-700">
                            A wallet exists but requires a password to unlock.
                        </p>
                    </div>

                    {!showLoadForm ? (
                        <button
                            onClick={() => setShowLoadForm(true)}
                            className="w-full px-4 py-2 bg-bitbadges-500 text-white rounded hover:bg-bitbadges-600"
                        >
                            Unlock Wallet
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={loadPassword}
                                    onChange={(e) =>
                                        setLoadPassword(e.target.value)
                                    }
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-bitbadges-500"
                                    placeholder="Enter wallet password"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleLoadWallet}
                                    disabled={loading || !loadPassword}
                                    className="flex-1 px-4 py-2 bg-bitbadges-500 text-white rounded hover:bg-bitbadges-600 disabled:opacity-50"
                                >
                                    Unlock
                                </button>
                                <button
                                    onClick={() => setShowLoadForm(false)}
                                    className="px-4 py-2 border rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-semibold text-blue-800 mb-2">
                            Setup AI Agent Wallet
                        </h3>
                        <p className="text-sm text-blue-700">
                            Give your AI agent its own Ethereum wallet for
                            blockchain interactions.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Setup Method
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setSetupMode('auto')}
                                    className={cn(
                                        'p-3 border rounded-lg text-sm',
                                        setupMode === 'auto'
                                            ? 'border-bitbadges-500 bg-bitbadges-50 text-bitbadges-700'
                                            : 'border-gray-200 hover:bg-gray-50'
                                    )}
                                >
                                    <Key size={16} className="mx-auto mb-1" />
                                    Auto-Generate
                                </button>
                                <button
                                    onClick={() => setSetupMode('manual')}
                                    className={cn(
                                        'p-3 border rounded-lg text-sm',
                                        setupMode === 'manual'
                                            ? 'border-bitbadges-500 bg-bitbadges-50 text-bitbadges-700'
                                            : 'border-gray-200 hover:bg-gray-50'
                                    )}
                                >
                                    <Shield
                                        size={16}
                                        className="mx-auto mb-1"
                                    />
                                    Enter Seed Phrase
                                </button>
                            </div>
                        </div>

                        {setupMode === 'manual' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Mnemonic Seed Phrase
                                </label>
                                <div className="relative">
                                    <input
                                        value={mnemonic}
                                        onChange={(e) =>
                                            setMnemonic(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-bitbadges-500 font-mono text-sm"
                                        placeholder="Enter your 12 or 24 word mnemonic phrase..."
                                        type={
                                            showMnemonic ? 'text' : 'password'
                                        }
                                    />
                                    <button
                                        onClick={() =>
                                            setShowMnemonic(!showMnemonic)
                                        }
                                        className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
                                    >
                                        {showMnemonic ? (
                                            <EyeOff size={16} />
                                        ) : (
                                            <Eye size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={usePassword}
                                    onChange={(e) =>
                                        setUsePassword(e.target.checked)
                                    }
                                    className="rounded"
                                />
                                <span className="text-sm">
                                    Encrypt wallet with password
                                </span>
                            </label>
                        </div>

                        {usePassword && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-bitbadges-500"
                                        placeholder="Enter password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) =>
                                            setConfirmPassword(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-bitbadges-500"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleCreateWallet}
                            disabled={
                                loading ||
                                (setupMode === 'manual' && !mnemonic) ||
                                (usePassword &&
                                    (!password || password !== confirmPassword))
                            }
                            className="w-full px-4 py-2 bg-bitbadges-500 text-white rounded hover:bg-bitbadges-600 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Wallet'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
