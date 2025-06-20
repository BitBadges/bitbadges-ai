import { AlertCircle, Coins, DollarSign, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { cn } from '../utils/cn';

interface WalletBalanceProps {
    hasWallet: boolean;
    address?: string;
    className?: string;
    onBalanceLoad?: (balance: string) => void;
}

interface BalanceData {
    ubadge: string;
    badge: string;
    address: string;
    displayBalance: string;
    rawBalance: string;
}

export const WalletBalance: React.FC<WalletBalanceProps> = ({
    hasWallet,
    address,
    className,
    onBalanceLoad,
}) => {
    const [balance, setBalance] = useState<BalanceData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (hasWallet) {
            loadBalance();
        }
    }, [hasWallet, address]);

    const loadBalance = async () => {
        if (!hasWallet) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                `${
                    (import.meta as any).env?.VITE_API_URL?.replace(
                        '/api',
                        ''
                    ) || 'http://localhost:3005'
                }/api/wallet/badgebalance`
            );
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch balance');
            }

            setBalance(data);
            onBalanceLoad?.(data.badge);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Failed to load balance'
            );
        } finally {
            setLoading(false);
        }
    };

    const formatBalance = (badgeAmount: string) => {
        const num = parseFloat(badgeAmount);
        if (num === 0) return '0';
        if (num < 0.000001) return '< 0.000001';
        if (num < 1) return num.toFixed(6);
        if (num < 1000) return num.toFixed(3);
        if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
        return (num / 1000000).toFixed(2) + 'M';
    };

    if (!hasWallet) {
        return (
            <div
                className={cn(
                    'bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center',
                    className
                )}
            >
                <Coins className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Connect wallet to view balance</p>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'bg-gradient-to-br from-purple-50 to-indigo-100 border border-purple-200 rounded-lg p-6',
                className
            )}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-purple-900">
                        Wallet Balance
                    </h3>
                </div>
                <button
                    onClick={loadBalance}
                    disabled={loading}
                    className="p-2 text-purple-600 hover:bg-purple-200 rounded-full transition-colors disabled:opacity-50"
                    title="Refresh balance"
                >
                    <RefreshCw
                        className={cn('w-4 h-4', loading && 'animate-spin')}
                    />
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-red-800 text-sm">{error}</span>
                </div>
            )}

            {balance ? (
                <div className="space-y-3">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-purple-900 mb-1">
                            {formatBalance(balance.badge)}{' '}
                            <span className="text-purple-600">$BADGE</span>
                        </div>
                        <div className="text-sm text-purple-600">
                            {balance.ubadge} ubadge
                        </div>
                    </div>

                    <div className="pt-3 border-t border-purple-200">
                        <div className="text-xs text-purple-700 mb-1">
                            BitBadges Address:
                        </div>
                        <div className="text-xs font-mono text-purple-800 break-all word-break bg-white/50 p-2 rounded leading-tight">
                            {balance.address}
                        </div>
                    </div>

                    <div className="text-xs text-purple-600 text-center">
                        1 $BADGE = 1,000,000,000 ubadge
                    </div>
                </div>
            ) : loading ? (
                <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 text-purple-600 animate-spin mx-auto mb-2" />
                    <p className="text-purple-700">Loading balance...</p>
                </div>
            ) : (
                <div className="text-center py-4">
                    <p className="text-purple-700">
                        Click refresh to load balance
                    </p>
                </div>
            )}
        </div>
    );
};
