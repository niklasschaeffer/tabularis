import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Database, Terminal, Settings, Table as TableIcon, Loader2, Copy, Hash, PlaySquare, FileText, Plus, ChevronRight, ChevronDown, FileCode, Play, Edit, Trash2, PanelLeftClose, PanelLeft, Key, Columns, List, Link as LinkIcon, Folder } from 'lucide-react';
import clsx from 'clsx';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useDatabase } from '../../hooks/useDatabase';
import { useSavedQueries } from '../../hooks/useSavedQueries';
import type { SavedQuery } from '../../contexts/SavedQueriesContext';
import { ContextMenu } from '../ui/ContextMenu';
import { SchemaModal } from '../ui/SchemaModal';
import { CreateTableModal } from '../ui/CreateTableModal';
import { QueryModal } from '../ui/QueryModal';
import { ModifyColumnModal } from '../ui/ModifyColumnModal';

interface TableColumn {
  name: string;
  data_type: string;
  is_pk: boolean;
  is_nullable: boolean;
  is_auto_increment: boolean;
}

interface ForeignKey {
    name: string;
    column_name: string;
    ref_table: string;
    ref_column: string;
}

interface Index {
    name: string;
    column_name: string;
    is_unique: boolean;
    is_primary: boolean;
}

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label, isConnected }: { to: string; icon: React.ElementType; label: string; isConnected?: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        'flex items-center justify-center w-12 h-12 rounded-lg transition-colors mb-2 relative group',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      )
    }
  >
    <div className="relative">
      <Icon size={24} />
      {isConnected && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-slate-900"></span>
      )}
    </div>
    <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
      {label}
    </span>
  </NavLink>
);

const Accordion = ({ title, isOpen, onToggle, children, actions }: AccordionProps) => (

  <div className="flex flex-col mb-2">
    <div className="flex items-center justify-between px-2 py-1 group/acc">
        <button 
            onClick={onToggle}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors select-none flex-1"
        >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>{title}</span>
        </button>
        {actions}
    </div>
    {isOpen && <div>{children}</div>}
  </div>
);

const SidebarColumnItem = ({ 
    column, 
    tableName,
    connectionId,
    driver,
    onRefresh,
    onEdit
}: { 
    column: TableColumn; 
    tableName: string;
    connectionId: string;
    driver: string;
    onRefresh: () => void;
    onEdit: (column: TableColumn) => void;
}) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleDelete = async () => {
        const confirmed = await ask(
            `Are you sure you want to delete column "${column.name}" from table "${tableName}"?\n\nWARNING: This will permanently delete all data in this column. This action cannot be undone.`,
            { title: 'Delete Column', kind: 'warning' }
        );

        if (confirmed) {
            try {
                const q = (driver === 'mysql' || driver === 'mariadb') ? '`' : '"';
                const query = `ALTER TABLE ${q}${tableName}${q} DROP COLUMN ${q}${column.name}${q}`;
                
                await invoke('execute_query', {
                    connectionId,
                    query
                });
                
                onRefresh();
            } catch (e) {
                console.error(e);
                await message(`Failed to delete column: ${e}`, { title: 'Error', kind: 'error' });
            }
        }
    };

    return (
        <>
            <div 
                className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono"
                onContextMenu={handleContextMenu}
                onDoubleClick={() => onEdit(column)}
            >
                {column.is_pk ? (
                    <Key size={12} className="text-yellow-500 shrink-0" />
                ) : (
                    <Columns size={12} className="text-slate-600 shrink-0" />
                )}
                <span className={clsx("truncate", column.is_pk && "font-bold text-yellow-500/80")}>
                    {column.name}
                </span>
                <span className="text-slate-600 text-[10px] ml-auto">
                    {column.data_type}
                </span>
            </div>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: 'Modify Column',
                            icon: Edit,
                            action: () => onEdit(column)
                        },
                        {
                            label: 'Copy Name',
                            icon: Copy,
                            action: () => navigator.clipboard.writeText(column.name)
                        },
                        {
                            label: 'Delete Column',
                            icon: Trash2,
                            danger: true,
                            action: handleDelete
                        }
                    ]}
                />
            )}
        </>
    );
};

const SidebarTableItem = ({ 
    table, 
    activeTable, 
    onTableClick, 
    onContextMenu,
    connectionId,
    driver,
    onAddColumn,
    onEditColumn
}: { 
    table: { name: string }; 
    activeTable: string | null;
    onTableClick: (name: string) => void;
    onContextMenu: (e: React.MouseEvent, type: 'table', id: string, label: string) => void;
    connectionId: string;
    driver: string;
    onAddColumn: (tableName: string) => void;
    onEditColumn: (tableName: string, col: TableColumn) => void;
}) => {
    // Prevent unused variable warning
    void onAddColumn;

    const [isExpanded, setIsExpanded] = useState(false);
    const [columns, setColumns] = useState<TableColumn[]>([]);
    const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
    const [indexes, setIndexes] = useState<Index[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Sub-expansion states
    const [expandColumns, setExpandColumns] = useState(true);
    const [expandKeys, setExpandKeys] = useState(false);
    const [expandIndexes, setExpandIndexes] = useState(false);

    const handleExpand = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isExpanded) {
            setIsExpanded(false);
            return;
        }

        setIsExpanded(true);
        refreshMetadata();
    };

    const refreshMetadata = async () => {
        if (!connectionId) return;
        setIsLoading(true);
        try {
            // Parallel fetch for speed
            const [cols, fks, idxs] = await Promise.all([
                invoke<TableColumn[]>('get_columns', { connectionId, tableName: table.name }),
                invoke<ForeignKey[]>('get_foreign_keys', { connectionId, tableName: table.name }),
                invoke<Index[]>('get_indexes', { connectionId, tableName: table.name })
            ]);
            
            setColumns(cols);
            setForeignKeys(fks);
            setIndexes(idxs);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, 'table', table.name, table.name);
    };

    // Group indexes by name since API returns one row per column
    const groupedIndexes = React.useMemo(() => {
        const groups: Record<string, Index & { columns: string[] }> = {};
        indexes.forEach(idx => {
            if (!groups[idx.name]) {
                groups[idx.name] = { ...idx, columns: [] };
            }
            groups[idx.name].columns.push(idx.column_name);
        });
        return Object.values(groups);
    }, [indexes]);

    // Separate PKs from Indexes for "keys" folder?
    // DataGrip puts PK and Unique constraints in "keys". 
    // Indexes (non-unique or explicit indexes) in "indexes".
    // Currently `get_indexes` returns all indexes including PK/Unique backing indexes.
    
    const keys = groupedIndexes.filter(i => i.is_primary || i.is_unique);
    const pureIndexes = groupedIndexes.filter(i => !i.is_primary && !i.is_unique);

    return (
        <div className="flex flex-col">
            <div 
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', table.name);
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onTableClick(table.name)}
                onContextMenu={handleContextMenu}
                className={clsx(
                    "flex items-center gap-1 pl-1 pr-3 py-1.5 text-sm cursor-pointer group select-none transition-colors border-l-2",
                    activeTable === table.name 
                    ? "bg-blue-900/40 text-blue-200 border-blue-500" 
                    : "text-slate-300 hover:bg-slate-800 border-transparent hover:text-white"
                )}
            >
                <button 
                    onClick={handleExpand}
                    className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
                >
                    {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                </button>
                <TableIcon size={14} className={activeTable === table.name ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400"} />
                <span className="truncate flex-1">{table.name}</span>
            </div>
            {isExpanded && (
                <div className="ml-[22px] border-l border-slate-800">
                    {isLoading ? (
                        <div className="flex items-center gap-2 p-2 text-xs text-slate-500">
                            <Loader2 size={12} className="animate-spin" />
                            Loading...
                        </div>
                    ) : (
                        <>
                            {/* Columns Folder */}
                            <div className="flex flex-col">
                                <div 
                                    className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                                    onClick={(e) => { e.stopPropagation(); setExpandColumns(!expandColumns); }}
                                >
                                    <Folder size={12} className="text-blue-400/70" />
                                    <span>columns</span>
                                    <span className="ml-auto text-[10px] opacity-50">{columns.length}</span>
                                </div>
                                {expandColumns && (
                                    <div className="ml-4 border-l border-slate-800/50">
                                        {columns.map(col => (
                                            <SidebarColumnItem 
                                                key={col.name} 
                                                column={col} 
                                                tableName={table.name}
                                                connectionId={connectionId}
                                                driver={driver}
                                                onRefresh={refreshMetadata}
                                                onEdit={(c) => onEditColumn(table.name, c)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Keys Folder (PK/Unique) */}
                            {(keys.length > 0) && (
                                <div className="flex flex-col">
                                    <div 
                                        className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                                        onClick={(e) => { e.stopPropagation(); setExpandKeys(!expandKeys); }}
                                    >
                                        <Folder size={12} className="text-yellow-500/70" />
                                        <span>keys</span>
                                        <span className="ml-auto text-[10px] opacity-50">{keys.length}</span>
                                    </div>
                                    {expandKeys && (
                                        <div className="ml-4 border-l border-slate-800/50">
                                            {keys.map(k => (
                                                <div key={k.name} className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono" title={k.columns.join(', ')}>
                                                    <Key size={12} className={k.is_primary ? "text-yellow-500" : "text-slate-400"} />
                                                    <span className="truncate">{k.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Foreign Keys Folder */}
                            {(foreignKeys.length > 0) && (
                                <div className="flex flex-col">
                                    <div 
                                        className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                                        // Auto expand FKs? Maybe keep collapsed by default
                                    >
                                        <Folder size={12} className="text-purple-400/70" />
                                        <span>foreign keys</span>
                                        <span className="ml-auto text-[10px] opacity-50">{foreignKeys.length}</span>
                                    </div>
                                    <div className="ml-4 border-l border-slate-800/50">
                                        {foreignKeys.map(fk => (
                                            <div key={fk.name} className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono" title={`${fk.column_name} -> ${fk.ref_table}.${fk.ref_column}`}>
                                                <LinkIcon size={12} className="text-purple-400" />
                                                <span className="truncate">{fk.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Indexes Folder */}
                            {(pureIndexes.length > 0) && (
                                <div className="flex flex-col">
                                    <div 
                                        className="flex items-center gap-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 cursor-pointer select-none"
                                        onClick={(e) => { e.stopPropagation(); setExpandIndexes(!expandIndexes); }}
                                    >
                                        <Folder size={12} className="text-green-400/70" />
                                        <span>indexes</span>
                                        <span className="ml-auto text-[10px] opacity-50">{pureIndexes.length}</span>
                                    </div>
                                    {expandIndexes && (
                                        <div className="ml-4 border-l border-slate-800/50">
                                            {pureIndexes.map(idx => (
                                                <div key={idx.name} className="flex items-center gap-2 px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer group font-mono" title={idx.columns.join(', ')}>
                                                    <List size={12} className="text-green-400" />
                                                    <span className="truncate">{idx.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export const Sidebar = () => {
  const { activeConnectionId, activeDriver, activeTable, setActiveTable, tables, isLoadingTables, refreshTables } = useDatabase();
  const { queries, deleteQuery, updateQuery } = useSavedQueries();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'table' | 'query'; id: string; label: string; data?: SavedQuery } | null>(null);
  const [schemaModalTable, setSchemaModalTable] = useState<string | null>(null);
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [modifyColumnModal, setModifyColumnModal] = useState<{ isOpen: boolean; tableName: string; column: TableColumn | null }>({ isOpen: false, tableName: '', column: null });
  
  const [queriesOpen, setQueriesOpen] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);
  const [queryModal, setQueryModal] = useState<{ isOpen: boolean; query?: SavedQuery }>({ isOpen: false });
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  const getQuote = () => (activeDriver === 'mysql' || activeDriver === 'mariadb') ? '`' : '"';

  const runQuery = (sql: string, queryName?: string) => {
    navigate('/editor', {
      state: { initialQuery: sql, queryName }
    });
  };

  const handleTableClick = (tableName: string) => {
    setActiveTable(tableName);
    const q = getQuote();
    navigate('/editor', {
      state: { 
        initialQuery: `SELECT * FROM ${q}${tableName}${q} LIMIT 100`,
        tableName: tableName
      }
    });
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'table' | 'query', id: string, label: string, data?: SavedQuery) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, label, data });
  };

  return (
    <div className="flex h-full">
      {/* Primary Navigation Bar (Narrow) */}
      <aside className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 z-20">
        <div className="mb-8" title="debba.sql">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-blue-900/20 border border-blue-500/30">
            ds
          </div>
        </div>
        
        <nav className="flex-1 w-full flex flex-col items-center">
          <NavItem to="/" icon={Database} label="Connections" isConnected={!!activeConnectionId} />
          {activeConnectionId && (
            <NavItem to="/editor" icon={Terminal} label="SQL Editor" />
          )}
        </nav>

        <div className="mt-auto">
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </aside>

      {/* Secondary Sidebar (Schema Explorer) - Only visible when connected and not in settings or home */}
      {activeConnectionId && location.pathname !== '/settings' && location.pathname !== '/' && !isExplorerCollapsed && (
        <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 font-semibold text-sm text-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-blue-400"/>
              <span>Explorer</span>
            </div>
            <button
              onClick={() => setIsExplorerCollapsed(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 hover:bg-slate-800 rounded"
              title="Collapse Explorer"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2">
            {isLoadingTables ? (
              <div className="flex items-center justify-center h-20 text-slate-500 gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading schema...</span>
              </div>
            ) : (
              <>
                {/* Saved Queries */}
                <Accordion 
                    title={`Saved Queries (${queries.length})`}
                    isOpen={queriesOpen} 
                    onToggle={() => setQueriesOpen(!queriesOpen)}
                >
                    {queries.length === 0 ? (
                        <div className="text-center p-2 text-xs text-slate-600 italic">No saved queries</div>
                    ) : (
                        <div>
                            {queries.map(q => (
                                <div 
                                    key={q.id}
                                    onClick={() => runQuery(q.sql, q.name)}
                                    onContextMenu={(e) => handleContextMenu(e, 'query', q.id, q.name, q)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer group transition-colors"
                                    title={q.name}
                                >
                                    <FileCode size={14} className="text-green-500 shrink-0" />
                                    <span className="truncate">{q.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Accordion>

                {/* Tables */}
                <Accordion 
                    title={`Tables (${tables.length})`}
                    isOpen={tablesOpen}
                    onToggle={() => setTablesOpen(!tablesOpen)}
                    actions={
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsCreateTableModalOpen(true); }}
                            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
                            title="Create New Table"
                        >
                            <Plus size={14} />
                        </button>
                    }
                >
                    {tables.length === 0 ? (
                        <div className="text-center p-2 text-xs text-slate-600 italic">No tables found</div>
                    ) : (
                        <div>
                            {tables.map(table => (
                                <SidebarTableItem
                                    key={table.name}
                                    table={table}
                                    activeTable={activeTable}
                                    onTableClick={handleTableClick}
                                    onContextMenu={handleContextMenu}
                                    connectionId={activeConnectionId!}
                                    driver={activeDriver!}
                                    onAddColumn={(t) => setModifyColumnModal({ isOpen: true, tableName: t, column: null })}
                                    onEditColumn={(t, c) => setModifyColumnModal({ isOpen: true, tableName: t, column: c })}
                                />
                            ))}
                        </div>
                    )}
                </Accordion>
              </>
            )}
          </div>
        </aside>
      )}

      {/* Collapsed Explorer (Icon only) */}
      {activeConnectionId && location.pathname !== '/settings' && location.pathname !== '/' && isExplorerCollapsed && (
        <div className="w-12 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-4">
          <button
            onClick={() => setIsExplorerCollapsed(false)}
            className="text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg p-2 transition-colors group relative"
            title="Expand Explorer"
          >
            <PanelLeft size={20} />
            <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
              Expand Explorer
            </span>
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            contextMenu.type === 'table' ? [
                {
                    label: 'Select Top 100',
                    icon: PlaySquare,
                    action: () => {
                        const q = getQuote();
                        runQuery(`SELECT * FROM ${q}${contextMenu.id}${q} LIMIT 100`);
                    }
                },
                {
                    label: 'Count Rows',
                    icon: Hash,
                    action: () => {
                        const q = getQuote();
                        runQuery(`SELECT COUNT(*) as count FROM ${q}${contextMenu.id}${q}`);
                    }
                },
                {
                    label: 'View Schema',
                    icon: FileText,
                    action: () => setSchemaModalTable(contextMenu.id)
                },
                {
                    label: 'Copy Name',
                    icon: Copy,
                    action: () => navigator.clipboard.writeText(contextMenu.id)
                },
                {
                    label: 'Add Column',
                    icon: Plus,
                    action: () => setModifyColumnModal({ isOpen: true, tableName: contextMenu.id, column: null })
                }
            ] : [
                // Saved Query Actions
                {
                    label: 'Execute',
                    icon: Play,
                    action: () => {
                        if (contextMenu.data?.sql) runQuery(contextMenu.data.sql, contextMenu.data.name);
                    }
                },
                {
                    label: 'Edit',
                    icon: Edit,
                    action: () => {
                        setQueryModal({ isOpen: true, query: contextMenu.data });
                    }
                },
                {
                    label: 'Delete',
                    icon: Trash2,
                    action: async () => {
                        const confirmed = await ask(`Are you sure you want to delete "${contextMenu.label}"?`, {
                            title: 'Confirm Delete',
                            kind: 'warning'
                        });
                        if (confirmed) {
                            deleteQuery(contextMenu.id);
                        }
                    }
                }
            ]
          }
        />
      )}

      {schemaModalTable && (
        <SchemaModal 
          isOpen={true} 
          tableName={schemaModalTable} 
          onClose={() => setSchemaModalTable(null)} 
        />
      )}

      {isCreateTableModalOpen && (
        <CreateTableModal
          isOpen={isCreateTableModalOpen}
          onClose={() => setIsCreateTableModalOpen(false)}
          onSuccess={() => {
              if (refreshTables) refreshTables();
          }}
        />
      )}

      {queryModal.isOpen && (
        <QueryModal
            isOpen={queryModal.isOpen}
            onClose={() => setQueryModal({ isOpen: false })}
            title={queryModal.query ? "Edit Query" : "Save Query"}
            initialName={queryModal.query?.name}
            initialSql={queryModal.query?.sql}
            onSave={async (name: string, sql: string) => {
                if (queryModal.query) {
                    await updateQuery(queryModal.query.id, name, sql);
                }
            }}
        />
      )}

      {modifyColumnModal.isOpen && activeConnectionId && (
        <ModifyColumnModal
          isOpen={modifyColumnModal.isOpen}
          onClose={() => setModifyColumnModal({ ...modifyColumnModal, isOpen: false })}
          onSuccess={() => {
              // We need to refresh the specific table columns. 
              // Currently SidebarTableItem manages its own state and we don't have a direct trigger.
              // However, collapsing and expanding will refresh it.
              // For now, let's just refresh the whole tables list which is overkill but safe,
              // or trust user to collapse/expand.
              // Ideally we pass a callback, but we are too high up.
              // Let's just rely on manual refresh for now, OR trigger a global refreshTables() which might not refresh columns if they are lazy loaded.
              // Actually, refreshTables() only reloads table names.
              // The columns are loaded in SidebarTableItem.
              
              // We could force a re-render by changing a key, but that resets expansion state.
              // Let's accept that user might need to collapse/expand to see new column or changes.
          }}
          connectionId={activeConnectionId}
          tableName={modifyColumnModal.tableName}
          driver={activeDriver || 'sqlite'}
          column={modifyColumnModal.column}
        />
      )}
    </div>
  );
};
