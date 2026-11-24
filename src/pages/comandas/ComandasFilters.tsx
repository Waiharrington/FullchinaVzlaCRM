import { Search, Calendar, ChevronDown, Filter, Package, X } from 'lucide-react'
import { ComandaOrder } from '../comandas/model'
import type { Dispatch, SetStateAction, RefObject } from 'react'

export interface ComandasFiltersProps {
  filtersBarRef: RefObject<HTMLDivElement | null>
  hasActiveFilters: boolean
  setMobileFiltersOpen: Dispatch<SetStateAction<boolean>>
  mobileFiltersOpen: boolean
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  dateFilter: "today" | "yesterday"
  setOpenFilterMenu: Dispatch<SetStateAction<"status" | "date" | "type" | null>>
  openFilterMenu: "status" | "date" | "type" | null
  setDateFilter: Dispatch<SetStateAction<"today" | "yesterday">>
  statusFilter: "new" | "preparing" | "ready" | "delivered" | "all"
  STATUS_FILTER_OPTIONS: { value: "all" | ComandaOrder["status"]; label: string; }[]
  setStatusFilter: Dispatch<SetStateAction<"new" | "preparing" | "ready" | "delivered" | "all">>
  orderTypeFilter: "all" | "Delivery" | "Para llevar" | "Mesa"
  ORDER_TYPE_FILTER_OPTIONS: { value: "all" | "Delivery" | "Para llevar" | "Mesa"; label: string; }[]
  setOrderTypeFilter: Dispatch<SetStateAction<"all" | "Delivery" | "Para llevar" | "Mesa">>
  clearFilters: () => void
}

export function ComandasFilters({ filtersBarRef, hasActiveFilters, setMobileFiltersOpen, mobileFiltersOpen, searchQuery, setSearchQuery, dateFilter, setOpenFilterMenu, openFilterMenu, setDateFilter, statusFilter, STATUS_FILTER_OPTIONS, setStatusFilter, orderTypeFilter, ORDER_TYPE_FILTER_OPTIONS, setOrderTypeFilter, clearFilters }: ComandasFiltersProps) {
  return (
    <div className="comandas-filters" ref={filtersBarRef}>
        <div className="comandas-filters-toprow">
          <button
            type="button"
            className={`comandas-mobile-filters-toggle ${hasActiveFilters ? 'filter-active' : ''}`}
            onClick={() => setMobileFiltersOpen(prev => !prev)}
          >
            <Filter size={14} />
            <span>Filtros</span>
            {hasActiveFilters && <span className="filter-dot" />}
            <ChevronDown size={12} className={mobileFiltersOpen ? 'rotated' : ''} />
          </button>

          <div className="filter-search-inline">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Borrar búsqueda">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className={`comandas-filter-chips ${mobileFiltersOpen ? 'mobile-open' : ''}`}>
        <div className="filter-dropdown-wrap">
          <button
            type="button"
            className={`filter-group-item ${dateFilter !== 'today' ? 'filter-active' : ''}`}
            onClick={() => setOpenFilterMenu(prev => (prev === 'date' ? null : 'date'))}
          >
            <Calendar size={14} />
            <span>{dateFilter === 'today' ? 'Hoy' : 'Ayer'}</span>
            <ChevronDown size={12} />
          </button>
          {openFilterMenu === 'date' && (
            <div className="filter-dropdown-menu">
              {(['today', 'yesterday'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  className={dateFilter === value ? 'active' : ''}
                  onClick={() => { setDateFilter(value); setOpenFilterMenu(null) }}
                >
                  {value === 'today' ? 'Hoy' : 'Ayer'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <button
            type="button"
            className={`filter-group-item filter-status-control ${statusFilter !== 'all' ? 'filter-active' : ''}`}
            onClick={() => setOpenFilterMenu(prev => (prev === 'status' ? null : 'status'))}
          >
            <Filter size={14} />
            <span>{STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || 'Estado'}</span>
            <ChevronDown size={12} />
          </button>
          {openFilterMenu === 'status' && (
            <div className="filter-dropdown-menu">
              {STATUS_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={statusFilter === opt.value ? 'active' : ''}
                  onClick={() => { setStatusFilter(opt.value); setOpenFilterMenu(null) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <button
            type="button"
            className={`filter-group-item ${orderTypeFilter !== 'all' ? 'filter-active' : ''}`}
            onClick={() => setOpenFilterMenu(prev => (prev === 'type' ? null : 'type'))}
          >
            <Package size={14} />
            <span>{ORDER_TYPE_FILTER_OPTIONS.find(o => o.value === orderTypeFilter)?.label || 'Tipo'}</span>
            <ChevronDown size={12} />
          </button>
          {openFilterMenu === 'type' && (
            <div className="filter-dropdown-menu">
              {ORDER_TYPE_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={orderTypeFilter === opt.value ? 'active' : ''}
                  onClick={() => { setOrderTypeFilter(opt.value); setOpenFilterMenu(null) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="filter-group-item filter-btn-dark filter-clear-control"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          <Filter size={14} />
          <span>Limpiar</span>
        </button>
        </div>
      </div>
  )
}
