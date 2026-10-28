import { useEffect, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, Copy, ExternalLink, Flame, Code2, Grid2X2, Layers, RefreshCw, ShieldCheck, Wallet, X } from 'lucide-react'
import { createPublicClient, createWalletClient, custom, fallback, formatUnits, http, isAddress, parseAbi, parseUnits, zeroAddress } from 'viem'
import type { Address, EIP1193Provider, Hash } from 'viem'
import { sepolia } from 'viem/chains'
import './App.css'

type Provider = EIP1193Provider & { isRabby?: boolean; providers?: Provider[] }
type Announce = { info: { rdns: string }; provider: Provider }
type Action = 'send' | 'burn' | 'receive' | null
type Snapshot = { supply: bigint; balance: bigint | null; eth: bigint | null }
type Transaction = { hash: Hash; label: string; status: 'pending' | 'confirmed' | 'failed' | 'unknown' }
const CONTRACT: Address = '0xC6315f52C537B61D77802ca6d7d1cBa6D983B782'
const EXPLORER = `https://sepolia.etherscan.io/address/${CONTRACT}`
const GITHUB = 'https://github.com/nelsonalexis/bionex-token'
const INITIAL = 1_000_000n * 10n ** 18n
const abi = parseAbi(['function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)', 'function burn(uint256)'])
const client = createPublicClient({ chain: sepolia, transport: fallback([http('https://ethereum-sepolia-rpc.publicnode.com'), http('https://11155111.rpc.thirdweb.com')]) })
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`
function amount(value: bigint | null | undefined, digits = 4) {
  if (value == null) return '—'
  // Format the integer and fractional parts without rounding through Number.
  const [whole, fraction = ''] = formatUnits(value, 18).split('.')
  const grouped = BigInt(whole).toLocaleString('en-US')
  const tail = fraction.slice(0, digits).replace(/0+$/, '')
  return grouped + (tail ? `.${tail}` : '')
}
function message(err: unknown) {
  return err && typeof err === 'object' && 'shortMessage' in err ? String(err.shortMessage) : err instanceof Error ? err.message : 'Please try again.'
}
function Mark({ small = false }: { small?: boolean }) {
  return <span className={`mark ${small ? 'small-mark' : ''}`} aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M11 7h10c11 0 12 13 2 13H11V7Zm0 13h13c11 0 11 13 0 13H11V20Z" stroke="currentColor" strokeWidth="4"/><path d="m8 9 23 23" stroke="currentColor" strokeWidth="4"/></svg></span>
}
export default function App() {
  const providerRef = useRef<Provider | null>(null)
  const generation = useRef(0)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [account, setAccount] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<Action>(null)
  const [recipient, setRecipient] = useState('')
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [tab, setTab] = useState('overview')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const sepoliaActive = chainId === sepolia.id

  useEffect(() => {
    const announced = (event: Event) => {
      const detail = (event as CustomEvent<Announce>).detail
      if (detail.info.rdns === 'io.rabby') setProvider(detail.provider)
    }
    window.addEventListener('eip6963:announceProvider', announced)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    const browser = window as Window & { ethereum?: Provider; rabby?: Provider }
    const injected = browser.rabby ?? browser.ethereum?.providers?.find(p => p.isRabby) ?? (browser.ethereum?.isRabby ? browser.ethereum : undefined)
    if (injected) setProvider(injected)
    return () => window.removeEventListener('eip6963:announceProvider', announced)
  }, [])

  useEffect(() => {
    providerRef.current = provider
    if (!provider) return
    const accountsChanged = (accounts: string[]) => {
      generation.current += 1
      setAccount((accounts[0] as Address | undefined) ?? null)
      setSnapshot(null)
    }
    const chainChanged = (id: string) => { generation.current += 1; setChainId(Number(id)) }
    const disconnected = () => { generation.current += 1; setAccount(null); setChainId(null); setSnapshot(null) }
    provider.on('accountsChanged', accountsChanged)
    provider.on('chainChanged', chainChanged)
    provider.on('disconnect', disconnected)
    return () => {
      provider.removeListener('accountsChanged', accountsChanged)
      provider.removeListener('chainChanged', chainChanged)
      provider.removeListener('disconnect', disconnected)
    }
  }, [provider])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setSnapshot(null)
    Promise.all([
      client.readContract({ address: CONTRACT, abi, functionName: 'totalSupply' }),
      account ? client.readContract({ address: CONTRACT, abi, functionName: 'balanceOf', args: [account] }) : Promise.resolve(null),
      account ? client.getBalance({ address: account }) : Promise.resolve(null),
    ]).then(([supply, balance, eth]) => { if (active) setSnapshot({ supply, balance, eth }) })
      .catch(err => { if (active) setError(`Sepolia data could not be loaded. ${message(err)}`) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [account, refresh])

  useEffect(() => {
    if (action) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [action])

  async function connect() {
    if (!provider) { setError('Rabby was not detected. Open this page in the browser where the extension is installed, then reload.'); return }
    setConnecting(true); setError('')
    try {
      const wallet = createWalletClient({ transport: custom(provider), chain: sepolia })
      const [address] = await wallet.requestAddresses()
      if (!address) throw new Error('No account selected.')
      setAccount(address)
      setChainId(await wallet.getChainId())
      await wallet.switchChain({ id: sepolia.id })
      setChainId(await wallet.getChainId())
    } catch (err) { setError(message(err)) }
    finally { setConnecting(false) }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Copied to clipboard.') }
    catch { setError('Could not copy automatically. Select and copy the address manually.') }
  }
  function open(next: Action) { setError(''); setQuantity(''); setRecipient(''); setAction(next) }
  async function transact() {
    if (!provider || !account || !snapshot || !sepoliaActive || busy) return
    setError(''); setBusy(true)
    let submitted: Hash | undefined
    try {
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quantity)) throw new Error('Enter a valid amount with up to 18 decimals.')
      const value = parseUnits(quantity, 18)
      if (value <= 0n || snapshot.balance == null || value > snapshot.balance) throw new Error('Enter an amount greater than zero and within your balance.')
      if (action === 'send' && (!isAddress(recipient) || recipient.toLowerCase() === zeroAddress || recipient.toLowerCase() === CONTRACT.toLowerCase())) throw new Error('Enter a valid recipient wallet address, not the Bionex contract.')
      const wallet = createWalletClient({ chain: sepolia, transport: custom(provider) })
      const revision = generation.current
      const [current] = await wallet.getAddresses()
      if (current?.toLowerCase() !== account.toLowerCase() || await wallet.getChainId() !== sepolia.id) throw new Error('Your wallet changed. Reconnect on Sepolia and try again.')
      const label = `${action === 'send' ? 'Sent' : 'Burned'} ${quantity} BNX`
      const assertWalletUnchanged = () => {
        if (revision !== generation.current || providerRef.current !== provider) throw new Error('Your wallet changed. Please retry.')
      }
      if (action === 'send') {
        const { request } = await client.simulateContract({ address: CONTRACT, abi, functionName: 'transfer', args: [recipient as Address, value], account })
        assertWalletUnchanged()
        submitted = await wallet.writeContract(request)
      } else {
        const { request } = await client.simulateContract({ address: CONTRACT, abi, functionName: 'burn', args: [value], account })
        assertWalletUnchanged()
        submitted = await wallet.writeContract(request)
      }
      const hash = submitted
      setTransactions(items => [{ hash, label, status: 'pending' }, ...items])
      setAction(null)
      const receipt = await client.waitForTransactionReceipt({ hash })
      setTransactions(items => items.map(item => item.hash === hash ? { ...item, status: receipt.status === 'success' ? 'confirmed' : 'failed' } : item))
      setRefresh(value => value + 1)
      if (receipt.status !== 'success') throw new Error('The transaction reverted. Check its explorer link.')
      setNotice('Transaction confirmed on Sepolia.')
    } catch (err) {
      if (submitted) setTransactions(items => items.map(item => item.hash === submitted && item.status === 'pending' ? { ...item, status: 'unknown' } : item))
      setError(message(err))
    } finally { setBusy(false) }
  }
  const burned = snapshot ? INITIAL - snapshot.supply : null
  const ownedBps = snapshot && snapshot.balance != null && snapshot.supply > 0n ? Number(snapshot.balance * 10000n / snapshot.supply) / 100 : 0
  const canTransact = !!account && sepoliaActive && !loading && !!snapshot && !busy
  const nav = [{ id: 'overview', label: 'Overview', icon: Grid2X2 }, { id: 'activity', label: 'My activity', icon: Layers }, { id: 'contract', label: 'Token details', icon: ShieldCheck }]
  return <div className="workspace">
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => setTab('overview')}><Mark /><span>bionex<span className="brand-dot">.</span></span></a>
      <span className="workspace-label">TOKEN WORKSPACE</span>
      <nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon size={19}/>{label}{tab === id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="learning-card"><span className="learning-icon"><BookOpen size={20}/></span><b>A token. A learning journey.</b><p>From your first contract to your first on-chain interaction.</p><a href={`${GITHUB}#readme`} target="_blank" rel="noreferrer">Explore the project <ArrowUpRight size={15}/></a></div><a className="source-link" href={GITHUB} target="_blank" rel="noreferrer"><Code2 size={18}/>Source code<ExternalLink size={14}/></a><span className="version">Bionex workspace · v1.0</span></div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={14}/><strong>{nav.find(n => n.id === tab)?.label}</strong></div><div className="top-actions"><span className="network"><i/>Sepolia <span>testnet</span></span><button className="wallet-button" onClick={connect} disabled={connecting}><Wallet size={17}/>{connecting ? 'Connecting…' : account ? short(account) : 'Connect wallet'}</button></div></header>
      <main>
        <div className="page-heading"><div><p className="eyebrow">YOUR ON-CHAIN WORKSPACE</p><h1>{tab === 'overview' ? 'Make yourself at home.' : tab === 'activity' ? 'Your moves, on chain.' : 'Meet Bionex.'}</h1><p className="subtitle">{tab === 'overview' ? 'A little more clarity. A lot more control over your BNX.' : tab === 'activity' ? 'Transactions you submit from this workspace, during this session.' : 'One token. A fixed initial supply. Everything in the open.'}</p></div><button className="icon-button" title="Refresh blockchain data" aria-label="Refresh blockchain data" disabled={loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={18} className={loading ? 'spinning' : ''}/></button></div>
        {error && <div className="alert" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
        {notice && <div className="notice" role="status"><CheckCircle2 size={18}/>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
        {account && !sepoliaActive && <div className="alert">Your wallet is on another network. Readings below are from Sepolia.<button onClick={connect}>Switch to Sepolia</button></div>}
        {tab === 'overview' && <>
          <section className="overview-grid"><div className="balance-panel"><div className="panel-top"><span className="caption">YOUR BNX BALANCE</span><span className="token-pill"><span>Β</span> Bionex</span></div><div className="balance-number">{loading ? '…' : amount(snapshot?.balance)}<span>BNX</span></div><p className="balance-caption">{account ? 'Held in your connected wallet on Sepolia' : 'Connect your wallet to see your tokens'}</p><div className="balance-actions"><button className="primary" disabled={!canTransact} onClick={() => open('send')}><ArrowUpRight/>Send tokens</button><button className="secondary" disabled={!account} onClick={() => open('receive')}><ArrowDownLeft/>Receive</button><button className="soft-button" disabled={!canTransact} onClick={() => open('burn')}><Flame/>Burn</button></div><div className="wallet-meta"><span><i/>{account ? 'Wallet connected' : 'Wallet not connected'}</span><span>{account ? short(account) : 'Rabby supported'}</span></div></div>
          <div className="token-story"><div className="story-top"><span className="tiny-tag">BUILT TO EXPLORE</span><ArrowUpRight size={22}/></div><div className="token-sculpture" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="token-disc"><Mark/></div><span className="floating-label">ERC-20</span></div><div><h2>Small token.<br/>Real possibilities.</h2><p>Explore Ethereum, one interaction at a time.</p></div></div></section>
          <section className="stats-row" aria-label="Token statistics"><div><span className="stat-icon"><Layers size={20}/></span><div><p>Total supply</p><strong>{loading ? '…' : amount(snapshot?.supply)} <small>BNX</small></strong></div></div><div><span className="stat-icon"><Flame size={20}/></span><div><p>Tokens burned</p><strong>{loading ? '…' : amount(burned)} <small>BNX</small></strong></div></div><div><span className="stat-icon"><Wallet size={20}/></span><div><p>Sepolia gas balance</p><strong>{loading ? '…' : amount(snapshot?.eth, 6)} <small>ETH</small></strong></div></div></section>
          <div className="lower-grid"><section className="panel holdings"><div className="section-title"><h2>Your token</h2><span className="quiet-tag">SEPOLIA</span></div><div className="asset-row"><Mark small/><div><strong>Bionex</strong><span>BNX · ERC-20</span></div><div className="asset-value"><strong>{loading ? '…' : amount(snapshot?.balance)}</strong><span>BNX in your wallet</span></div></div><div className="ownership-label"><span>Your share of current supply</span><strong>{account && snapshot ? `${ownedBps.toFixed(2)}%` : '—'}</strong></div><div className="ownership-track"><span style={{ width: `${ownedBps}%` }}/></div><p className="microcopy">Token ownership, not a market valuation.</p></section><section className="panel contract-card"><div className="section-title"><h2>Under the hood</h2><ShieldCheck size={19}/></div><dl><div><dt>Network</dt><dd>Ethereum Sepolia</dd></div><div><dt>Source verification</dt><dd><Check size={13}/>Sourcify match</dd></div><div><dt>Additional minting</dt><dd>Not available</dd></div></dl><a className="text-link" href={EXPLORER} target="_blank" rel="noreferrer">Explore the contract<ArrowUpRight size={16}/></a></section></div>
        </>}
        {tab === 'activity' && <section className="panel activity-panel"><div className="section-title"><h2>Session activity</h2><span className="quiet-tag">{transactions.length} TRANSACTIONS</span></div>{!transactions.length ? <div className="empty-state"><Layers size={32}/><h3>A fresh start.</h3><p>Your sends and burns will appear here once submitted.<br/>This is session activity, not your full wallet history.</p><button className="secondary" onClick={() => setTab('overview')}>Back to overview <ArrowUpRight size={16}/></button></div> : transactions.map(tx => <a className="transaction-row" key={tx.hash} href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noreferrer"><div><strong>{tx.label}</strong><span>{short(tx.hash)}</span></div><span className={`tx-status ${tx.status}`}>{tx.status}</span><ExternalLink size={16}/></a>)}</section>}
        {tab === 'contract' && <section className="panel details-panel"><Mark/><h2>Bionex / BNX</h2><p>A transferable and burnable ERC-20 token on Ethereum Sepolia.</p><dl><div><dt>Initial supply</dt><dd>1,000,000 BNX</dd></div><div><dt>Current supply</dt><dd>{amount(snapshot?.supply)} BNX</dd></div><div><dt>Decimals</dt><dd>18</dd></div><div><dt>Chain ID</dt><dd>11155111</dd></div><div><dt>Contract address</dt><dd className="full-address">{CONTRACT}<button className="inline-icon" aria-label="Copy contract address" onClick={() => copy(CONTRACT)}><Copy size={15}/></button></dd></div></dl><div className="details-links"><a className="primary" href={EXPLORER} target="_blank" rel="noreferrer">View on Etherscan<ArrowUpRight size={16}/></a><a className="secondary" href="https://sourcify.dev/server/verify-ui/jobs/24736afa-c4ad-411b-b413-075a29dbfb22" target="_blank" rel="noreferrer">Sourcify verification<ArrowUpRight size={16}/></a></div><p className="microcopy">Source verification is not a security audit. No additional minting is exposed. Burning permanently reduces supply.</p></section>}
        <footer><span><span className="footer-dot"/>An educational project on a test network.</span><a href={`${GITHUB}#readme`} target="_blank" rel="noreferrer">Made to learn. Built on Ethereum.<ArrowUpRight size={13}/></a></footer>
      </main>
    </div>
    <dialog ref={dialogRef} onCancel={event => { if (busy) event.preventDefault(); else setAction(null) }} onClose={() => { if (!busy) setAction(null) }}><div className="modal-head"><span className="eyebrow">BIONEX · SEPOLIA</span><button className="icon-button" disabled={busy} onClick={() => setAction(null)} aria-label="Close dialog"><X size={18}/></button></div><h2>{action === 'send' ? 'Send BNX' : action === 'burn' ? 'Burn BNX' : 'Receive BNX'}</h2>{action === 'receive' ? <><p>Send BNX on Ethereum Sepolia to this wallet address.</p><div className="receive-address">{account}</div><button className="primary full-width" onClick={() => account && copy(account)}><Copy size={16}/>Copy wallet address</button></> : <><p>{action === 'burn' ? 'Burning permanently destroys your tokens and reduces total supply. It cannot be undone.' : 'Transfer your tokens to another wallet on Sepolia.'}</p><form onSubmit={event => { event.preventDefault(); void transact() }}>{action === 'send' && <label>Recipient address<input required value={recipient} onChange={event => setRecipient(event.target.value.trim())} placeholder="0x…" disabled={busy}/></label>}<label>Amount in BNX<input required inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0.00" disabled={busy}/></label><span className="microcopy">Available: {amount(snapshot?.balance, 18)} BNX · Test ETH required for gas.</span>{error && <p role="alert" className="modal-error">{error}</p>}<button className={`primary full-width ${action === 'burn' ? 'burn-button' : ''}`} disabled={!canTransact || !quantity || (action === 'send' && !recipient)}>{busy ? 'Waiting for confirmation…' : action === 'burn' ? 'Confirm permanent burn in Rabby' : 'Review in Rabby'}<ArrowUpRight size={17}/></button></form></>}</dialog>
  </div>
}

