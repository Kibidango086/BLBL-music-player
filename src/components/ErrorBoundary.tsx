import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="fixed inset-0 z-[101] bg-background flex flex-col items-center justify-center gap-4">
          <div className="text-4xl">😿</div>
          <p className="text-muted-foreground text-[14px]">出错了</p>
          <p className="text-muted-foreground/60 text-[12px] max-w-md text-center">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg bg-primary text-primary-fg text-[13px] font-medium hover:brightness-110"
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
