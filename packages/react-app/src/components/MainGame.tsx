import { Contract } from 'ethers'
import React, { useEffect, useState } from 'react'
import { abi as ERC721 } from '@openzeppelin/contracts/build/contracts/ERC721.json'
import { Provider } from '@ethersproject/providers'
import { fetchJson } from '@ethersproject/web'
import { Button, Col, Row, Image, Card,Divider } from 'antd'
import axios from 'axios'
import { AwsClient } from 'aws4fetch'
import Meta from 'antd/lib/card/Meta'
import Leaderboard from './Leaderboard'

const login = async (provider, dispatch, setAwsClient) => {
  const pubKey = await provider.getSigner().getAddress()
  let { data: nonce } = await axios.get(
    `https://krtj8wyxtl.execute-api.us-west-1.amazonaws.com/nonce/${pubKey}`,
  )
  // sign the nonce
  const signature = await provider.getSigner().signMessage(nonce)
  // console.log({ signature })
  let { data: login } = await axios.post(
    `https://krtj8wyxtl.execute-api.us-west-1.amazonaws.com/login`,
    {
      id: pubKey,
      signature: signature,
      nonce: nonce,
    },
  )

  console.log({ login })

  if (login && login.Credentials && login.Credentials.AccessKeyId) {
    const aws = new AwsClient({
      accessKeyId: login.Credentials.AccessKeyId,
      secretAccessKey: login.Credentials.SecretKey,
      sessionToken: login.Credentials.SessionToken,
      region: 'us-west-1',
      service: 'execute-api',
    })
    // console.log(aws)
    setAwsClient(aws)
  }
}
type MainGameProps = {
  collectionAddress: string
  itemCount: number
  provider: Provider
  awsClient: AwsClient
  userAddress: string
  login: () => AwsClient | null
}

type Vote = {
  userId: string
  projectId: string
  winnerId: string
  loserId: string
}

const vote = async (
  voteO: Vote,
  awsClient: AwsClient,
  login: any,
  loadNew: any,
) => {
  if (!awsClient) {
    awsClient = await login()
  }
  const request = await awsClient.sign(
    'https://krtj8wyxtl.execute-api.us-west-1.amazonaws.com/votes',
    {
      method: 'POST',
      body: JSON.stringify(voteO),
    },
  )
  const response = await awsClient.fetch(request)
  console.log({ response })
  if (response.status === 200) {
    loadNew()
  } else if (response.status === 403) {
    awsClient = await login()
    await vote(voteO, awsClient, login, loadNew)
  } else if (response.status === 409) {
    loadNew()
  } else {
    alert('Error voting')
  }
}

function MainGame({
  collectionAddress,
  itemCount,
  provider,
  awsClient,
  userAddress,
  login,
}: MainGameProps) {
  const [imageUrls, setImageUrls] = useState<string[] | null>(null)
  const [nftNames, setNames] = useState<string[] | null>(null)
  const [nftIds, setIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (provider) {
      getTokenIds()
    }
  }, [])

  const getTokenIds = async () => {
    setImageUrls(['', ''])
    setNames(['Loading...', 'Loading...'])
    let collectionContract: Contract = new Contract(
      collectionAddress,
      ERC721,
      provider,
    )
    let token0Id = Math.floor(Math.random() * itemCount) + 1
    let token1Id = Math.floor(Math.random() * itemCount) + 1
    // hack, this can still produce duplicates
    if (token0Id === token1Id) {
      token1Id = Math.floor(Math.random() * itemCount) + 1
    }
    let token0Uri = await collectionContract.tokenURI(token0Id)
    let token1Uri = await collectionContract.tokenURI(token1Id)

    let token1JSONContent = await fetchJson(token1Uri)
    let token0JSONContent = await fetchJson(token0Uri)

    setImageUrls([token0JSONContent.image, token1JSONContent.image])
    setNames([token0JSONContent.name, token1JSONContent.name])
    setIds([token0Id.toString(), token1Id.toString()])
  }
  return (
    <div>
      {imageUrls && nftNames ? (
        <div>
          <Row gutter={[48, 16]}>
            <Col>
              <NFTDisplay
                imageUrl={imageUrls[0]}
                name={nftNames[0]}
                vote={() =>
                  vote(
                    {
                      userId: userAddress,
                      projectId: collectionAddress,
                      winnerId: nftIds![0],
                      loserId: nftIds![1],
                    },
                    awsClient,
                    login,
                    getTokenIds,
                  )
                }
              />
            </Col>
            <Col>
              {' '}
              <h2>⚔️</h2>{' '}
            </Col>
            <Col>
              <NFTDisplay
                imageUrl={imageUrls[1]}
                name={nftNames[1]}
                vote={() =>
                  vote(
                    {
                      userId: userAddress,
                      projectId: collectionAddress,
                      winnerId: nftIds![1],
                      loserId: nftIds![0],
                    },
                    awsClient,
                    login,
                    getTokenIds,
                  )
                }
              />
            </Col>
          </Row>
        </div>
      ) : (
        ''
      )}
      <Divider />
      <Leaderboard projectId={collectionAddress} />
    </div>
  )
}
type ImageProps = {
  imageUrl: string
  name: string
  vote: any
}
function NFTDisplay({ imageUrl, name, vote }: ImageProps) {
  return (
    <Card
      cover={
        <Image
          src={imageUrl}
          width="500px"
          fallback="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8c3ZnIHdpZHRoPSI0MHB4IiBoZWlnaHQ9IjQwcHgiIHZpZXdCb3g9IjAgMCA0MCA0MCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWw6c3BhY2U9InByZXNlcnZlIiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjEuNDE0MjE7IiB4PSIwcHgiIHk9IjBweCI+CiAgICA8ZGVmcz4KICAgICAgICA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPjwhW0NEQVRBWwogICAgICAgICAgICBALXdlYmtpdC1rZXlmcmFtZXMgc3BpbiB7CiAgICAgICAgICAgICAgZnJvbSB7CiAgICAgICAgICAgICAgICAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDBkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIHRvIHsKICAgICAgICAgICAgICAgIC13ZWJraXQtdHJhbnNmb3JtOiByb3RhdGUoLTM1OWRlZykKICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0KICAgICAgICAgICAgQGtleWZyYW1lcyBzcGluIHsKICAgICAgICAgICAgICBmcm9tIHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIHRvIHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKC0zNTlkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgICAgIHN2ZyB7CiAgICAgICAgICAgICAgICAtd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46IDUwJSA1MCU7CiAgICAgICAgICAgICAgICAtd2Via2l0LWFuaW1hdGlvbjogc3BpbiAxLjVzIGxpbmVhciBpbmZpbml0ZTsKICAgICAgICAgICAgICAgIC13ZWJraXQtYmFja2ZhY2UtdmlzaWJpbGl0eTogaGlkZGVuOwogICAgICAgICAgICAgICAgYW5pbWF0aW9uOiBzcGluIDEuNXMgbGluZWFyIGluZmluaXRlOwogICAgICAgICAgICB9CiAgICAgICAgXV0+PC9zdHlsZT4KICAgIDwvZGVmcz4KICAgIDxnIGlkPSJvdXRlciI+CiAgICAgICAgPGc+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yMCwwQzIyLjIwNTgsMCAyMy45OTM5LDEuNzg4MTMgMjMuOTkzOSwzLjk5MzlDMjMuOTkzOSw2LjE5OTY4IDIyLjIwNTgsNy45ODc4MSAyMCw3Ljk4NzgxQzE3Ljc5NDIsNy45ODc4MSAxNi4wMDYxLDYuMTk5NjggMTYuMDA2MSwzLjk5MzlDMTYuMDA2MSwxLjc4ODEzIDE3Ljc5NDIsMCAyMCwwWiIgc3R5bGU9ImZpbGw6YmxhY2s7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNNS44NTc4Niw1Ljg1Nzg2QzcuNDE3NTgsNC4yOTgxNSA5Ljk0NjM4LDQuMjk4MTUgMTEuNTA2MSw1Ljg1Nzg2QzEzLjA2NTgsNy40MTc1OCAxMy4wNjU4LDkuOTQ2MzggMTEuNTA2MSwxMS41MDYxQzkuOTQ2MzgsMTMuMDY1OCA3LjQxNzU4LDEzLjA2NTggNS44NTc4NiwxMS41MDYxQzQuMjk4MTUsOS45NDYzOCA0LjI5ODE1LDcuNDE3NTggNS44NTc4Niw1Ljg1Nzg2WiIgc3R5bGU9ImZpbGw6cmdiKDIxMCwyMTAsMjEwKTsiLz4KICAgICAgICA8L2c+CiAgICAgICAgPGc+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yMCwzMi4wMTIyQzIyLjIwNTgsMzIuMDEyMiAyMy45OTM5LDMzLjgwMDMgMjMuOTkzOSwzNi4wMDYxQzIzLjk5MzksMzguMjExOSAyMi4yMDU4LDQwIDIwLDQwQzE3Ljc5NDIsNDAgMTYuMDA2MSwzOC4yMTE5IDE2LjAwNjEsMzYuMDA2MUMxNi4wMDYxLDMzLjgwMDMgMTcuNzk0MiwzMi4wMTIyIDIwLDMyLjAxMjJaIiBzdHlsZT0iZmlsbDpyZ2IoMTMwLDEzMCwxMzApOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTI4LjQ5MzksMjguNDkzOUMzMC4wNTM2LDI2LjkzNDIgMzIuNTgyNCwyNi45MzQyIDM0LjE0MjEsMjguNDkzOUMzNS43MDE5LDMwLjA1MzYgMzUuNzAxOSwzMi41ODI0IDM0LjE0MjEsMzQuMTQyMUMzMi41ODI0LDM1LjcwMTkgMzAuMDUzNiwzNS43MDE5IDI4LjQ5MzksMzQuMTQyMUMyNi45MzQyLDMyLjU4MjQgMjYuOTM0MiwzMC4wNTM2IDI4LjQ5MzksMjguNDkzOVoiIHN0eWxlPSJmaWxsOnJnYigxMDEsMTAxLDEwMSk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNMy45OTM5LDE2LjAwNjFDNi4xOTk2OCwxNi4wMDYxIDcuOTg3ODEsMTcuNzk0MiA3Ljk4NzgxLDIwQzcuOTg3ODEsMjIuMjA1OCA2LjE5OTY4LDIzLjk5MzkgMy45OTM5LDIzLjk5MzlDMS43ODgxMywyMy45OTM5IDAsMjIuMjA1OCAwLDIwQzAsMTcuNzk0MiAxLjc4ODEzLDE2LjAwNjEgMy45OTM5LDE2LjAwNjFaIiBzdHlsZT0iZmlsbDpyZ2IoMTg3LDE4NywxODcpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTUuODU3ODYsMjguNDkzOUM3LjQxNzU4LDI2LjkzNDIgOS45NDYzOCwyNi45MzQyIDExLjUwNjEsMjguNDkzOUMxMy4wNjU4LDMwLjA1MzYgMTMuMDY1OCwzMi41ODI0IDExLjUwNjEsMzQuMTQyMUM5Ljk0NjM4LDM1LjcwMTkgNy40MTc1OCwzNS43MDE5IDUuODU3ODYsMzQuMTQyMUM0LjI5ODE1LDMyLjU4MjQgNC4yOTgxNSwzMC4wNTM2IDUuODU3ODYsMjguNDkzOVoiIHN0eWxlPSJmaWxsOnJnYigxNjQsMTY0LDE2NCk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNMzYuMDA2MSwxNi4wMDYxQzM4LjIxMTksMTYuMDA2MSA0MCwxNy43OTQyIDQwLDIwQzQwLDIyLjIwNTggMzguMjExOSwyMy45OTM5IDM2LjAwNjEsMjMuOTkzOUMzMy44MDAzLDIzLjk5MzkgMzIuMDEyMiwyMi4yMDU4IDMyLjAxMjIsMjBDMzIuMDEyMiwxNy43OTQyIDMzLjgwMDMsMTYuMDA2MSAzNi4wMDYxLDE2LjAwNjFaIiBzdHlsZT0iZmlsbDpyZ2IoNzQsNzQsNzQpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTI4LjQ5MzksNS44NTc4NkMzMC4wNTM2LDQuMjk4MTUgMzIuNTgyNCw0LjI5ODE1IDM0LjE0MjEsNS44NTc4NkMzNS43MDE5LDcuNDE3NTggMzUuNzAxOSw5Ljk0NjM4IDM0LjE0MjEsMTEuNTA2MUMzMi41ODI0LDEzLjA2NTggMzAuMDUzNiwxMy4wNjU4IDI4LjQ5MzksMTEuNTA2MUMyNi45MzQyLDkuOTQ2MzggMjYuOTM0Miw3LjQxNzU4IDI4LjQ5MzksNS44NTc4NloiIHN0eWxlPSJmaWxsOnJnYig1MCw1MCw1MCk7Ii8+CiAgICAgICAgPC9nPgogICAgPC9nPgo8L3N2Zz4K"
        />
      }
    >
      <Meta
        title={name}
        description={
          <Button onClick={() => vote()}> This one is better </Button>
        }
      />
    </Card>
  )
}
export default MainGame
