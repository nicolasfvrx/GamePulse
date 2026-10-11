import React from 'react';
import { Cpu, Bot, Server, Users } from 'lucide-react';
import type { OverviewStats } from '@gamepulse/shared';

interface StatsOverviewProps {
  stats: OverviewStats;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const cards = [
    {
      title: 'Workers Connectés',
      value: `${stats.online_workers} / ${stats.total_workers}`,
      subtitle: stats.online_workers > 0 ? 'Cluster opérationnel' : 'Aucun worker actif',
      icon: Cpu,
      color: 'emerald',
      statusColor: stats.online_workers > 0 ? 'text-emerald-400' : 'text-rose-400',
      bgGlow: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/30',
    },
    {
      title: 'Bots Discord',
      value: `${stats.active_bots} / ${stats.total_bots}`,
      subtitle: `${stats.active_bots} présence(s) actives`,
      icon: Bot,
      color: 'blue',
      statusColor: 'text-blue-400',
      bgGlow: 'from-blue-500/10 to-transparent',
      borderColor: 'border-blue-500/30',
    },
    {
      title: 'Serveurs DayZ En Ligne',
      value: `${stats.online_servers} / ${stats.total_bots}`,
      subtitle: 'Query A2S fonctionnelles',
      icon: Server,
      color: 'purple',
      statusColor: 'text-purple-400',
      bgGlow: 'from-purple-500/10 to-transparent',
      borderColor: 'border-purple-500/30',
    },
    {
      title: 'Joueurs Suivis en Direct',
      value: stats.total_players_tracked.toLocaleString(),
      subtitle: 'Sur les serveurs connectés',
      icon: Users,
      color: 'orange',
      statusColor: 'text-orange-400',
      bgGlow: 'from-orange-500/10 to-transparent',
      borderColor: 'border-orange-500/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-xl bg-gaming-900 border ${card.borderColor} p-5 transition-all hover:translate-y-[-2px]`}
          >
            <div className={`absolute -right-4 -bottom-4 w-28 h-28 bg-gradient-to-br ${card.bgGlow} rounded-full blur-2xl pointer-events-none`} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className={`p-2 rounded-lg bg-gaming-850 border border-gaming-800 ${card.statusColor}`}>
                <IconComponent className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {card.value}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
};
