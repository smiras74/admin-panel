'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Mail,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Download,
  Users
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Navigation } from '@/components/Navigation';

interface WaitlistEntry {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  createdAt?: string;
  source?: string;
}

export default function WaitlistPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchWaitlist() {
      try {
        const response = await fetch('/api/waitlist');
        if (response.ok) {
          const data = await response.json();
          setEntries(data.waitlist || []);
        }
      } catch (error) {
        console.error('Error fetching waitlist:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchWaitlist();
    }
  }, [user]);

  const copyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllEmails = () => {
    const emails = entries.map(e => e.email).join(', ');
    navigator.clipboard.writeText(emails);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadCSV = () => {
    const headers = ['Email', 'Prénom', 'Nom', 'Date inscription'];
    const rows = entries.map(e => [
      e.email,
      e.firstName || e.name?.split(' ')[0] || '',
      e.lastName || e.name?.split(' ').slice(1).join(' ') || '',
      e.createdAt ? new Date(e.createdAt).toLocaleDateString('fr-FR') : ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getDisplayName = (entry: WaitlistEntry) => {
    if (entry.firstName || entry.lastName) {
      return `${entry.firstName || ''} ${entry.lastName || ''}`.trim();
    }
    if (entry.name) {
      return entry.name;
    }
    return '—';
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-forest-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-6">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-100">Waitlist</h1>
              <p className="text-gray-400 mt-1">
                {entries.length} personne{entries.length !== 1 ? 's' : ''} en attente d'invitation
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={copyAllEmails}
                disabled={entries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-750 disabled:opacity-50"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copié!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copier tous les emails
                  </>
                )}
              </button>
              
              <button
                onClick={downloadCSV}
                disabled={entries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-750 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              
              <a
                href="https://www.kisskissbankbank.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-forest-600 rounded-lg text-sm text-white hover:bg-forest-700"
              >
                <ExternalLink className="w-4 h-4" />
                KissKissBankBank
              </a>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-xl p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-gray-700 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Aucune inscription en attente</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Nom</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Email</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400 hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-400 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-700/50 hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <span className="text-gray-100">{getDisplayName(entry)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-300">{entry.email}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-gray-500">
                          {entry.createdAt 
                            ? new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '—'
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyEmail(entry.email, entry.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                            title="Copier l'email"
                          >
                            {copiedId === entry.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={`mailto:${entry.email}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                            title="Envoyer un email"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
