import { useEffect, useRef } from 'react'
import { basicSetup, EditorView } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { placeholder } from '@codemirror/view'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'

interface SyntaxHighlightedCodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: 'python' | 'json' | 'markdown' | 'text'
  readOnly?: boolean
  placeholder?: string
  height?: string | number
  maxHeight?: string | number
  minHeight?: string | number
}

const languageExtensions = {
  python: python,
  json: json,
  markdown: markdown,
  text: () => []
}

export function SyntaxHighlightedCodeEditor({
  value,
  onChange,
  language = 'python',
  readOnly = false,
  placeholder = '',
  height = '100%',
  minHeight = 200,
  maxHeight
}: SyntaxHighlightedCodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const valueRef = useRef(value)

  // Update ref when value changes externally
  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    if (!editorRef.current) return

    const langExtension = languageExtensions[language]

    // Create editor state
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        langExtension(),
        EditorView.lineWrapping,
        EditorView.theme({
          '&': {
            height: typeof height === 'number' ? `${height}px` : height,
            ...(minHeight && { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }),
            ...(maxHeight && { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight })
          },
          '.cm-content': {
            padding: '12px',
            fontFamily: '"Fira Code", "JetBrains Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '14px',
            lineHeight: '1.4'
          },
          '.cm-editor': {
            borderRadius: '4px',
            border: '1px solid #e0e0e0'
          },
          '.cm-editor.cm-focused': {
            borderColor: '#1976d2',
            outline: 'none'
          },
          '.cm-scroller': {
            overflow: 'auto'
          },
          '.cm-placeholder': {
            color: '#9e9e9e'
          }
        }),
        EditorState.readOnly.of(readOnly),
        ...(placeholder ? [placeholder(placeholder)] : []),
        // Update callback
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange && !readOnly) {
            const newValue = update.state.doc.toString()
            if (newValue !== valueRef.current) {
              onChange(newValue)
            }
          }
        })
      ]
    })

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    // Cleanup function
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [language, readOnly, placeholder, height, minHeight, maxHeight])

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      const transaction = viewRef.current.state.update({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value
        }
      })
      viewRef.current.dispatch(transaction)
    }
  }, [value])

  return (
    <div 
      ref={editorRef} 
      style={{ 
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        ...(minHeight && { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }),
        ...(maxHeight && { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight })
      }} 
    />
  )
}